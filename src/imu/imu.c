#include "imu.h"
#include "imu_ekf.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>

//#define DEBUG_EVENTS

void imu_init(imu_data_t *imu_data)
{
    imu_data->imu_update_time = 0;
    imu_data->imu_mag_update_interval = 0;

    imu_data->sample_count = 0;

    imu_data->gyro_sample_time = 0;
    imu_data->gyro_sample = vec3(0, 0, 0);

    imu_data->pose_imu.rotation = quaternion(0, 0, 0, 1);
    imu_data->pose_imu.position = vec3(0, 0, 0);
    imu_data->pose_imu.timestamp = 0;

    imu_data->pose_gyro.rotation = quaternion(0, 0, 0, 1);
    imu_data->pose_gyro.position = vec3(0, 0, 0);
    imu_data->pose_gyro.timestamp = 0;

    imu_data->pose_mag.rotation = quaternion(0, 0, 0, 1);
    imu_data->pose_mag.position = vec3(0, 0, 0);
    imu_data->pose_mag.timestamp = 0;

    imu_data->acc_sample = vec3(0, 0, 1);

    imu_data->mag_declination = 0;
    imu_data->mag_offset = vec3(0, 0, 0);
    imu_data->mag_scale = vec3(1, 1, 1);
    imu_data->mag_alignment_hpr = vec3(0, 0, 0);

    imu_data->gyro_offset = vec3(0, 0, 0);
    imu_data->gyro_scale = vec3(1, 1, 1);
    imu_data->gyro_alignment_hpr = vec3(0, 0, 0);
    imu_data->gyro_scale_factor = 0.00122;

    imu_data->previous_rotation_time = 0;
}

void propogate_gyro(imu_data_t *imu_data, pose_t *pose, double timestamp)
{
    if (pose->timestamp == 0)
    {
        pose->timestamp = timestamp;
    }
    else
    {
        if (imu_data->gyro_sample_time != 0)
        {
            vec3_t gyro_counts = v3_mul(imu_data->gyro_scale, v3_sub(imu_data->gyro_sample, imu_data->gyro_offset));
            vec3_t gyro_unaligned_rps = v3_muls(gyro_counts, imu_data->gyro_scale_factor);
            vec3_t gyro;
            quaternion_rotate_vec3(quaternion_from_hpr(imu_data->gyro_alignment_hpr), gyro_unaligned_rps, &gyro);

            float delta_time = 1e-3 * (timestamp - pose->timestamp);
            pose->timestamp = timestamp;

            float gyro_magnitude = v3_length(gyro);
            float angle = 0, sinHalfAngle = 0, cosHalfAngle = 1;
            quaternion_t q_prop = quaternion(0, 0, 0, 1);
            if (gyro_magnitude > 0)
            {
                angle = gyro_magnitude * delta_time;
                sinHalfAngle = sin(angle / 2.0);
                cosHalfAngle = cos(angle / 2.0);

                vec3_t q_xyz = v3_muls(gyro, sinHalfAngle / gyro_magnitude);

                q_prop = quaternion(q_xyz.x, -q_xyz.y, -q_xyz.z, cosHalfAngle);
            }

            pose->rotation = quaternion_multiply(pose->rotation,q_prop);
        }
    }
}

void imu_update_gyro(imu_data_t *imu_data, nst_event_t event, nst_event_t *output_events, int *output_events_count)
{
    // store gyro to propogate on 50Hz timer
    imu_data->gyro_sample = vec3(event.values[0], event.values[1], event.values[2]);
    propogate_gyro(imu_data, &(imu_data->pose_gyro), event.timestamp);
    propogate_gyro(imu_data, &(imu_data->pose_imu), event.timestamp);
    imu_data->gyro_sample_time = event.timestamp;

    output_events[*output_events_count].timestamp = event.timestamp;
    output_events[*output_events_count].id = 2000;
    int value_count = 0;
    output_events[*output_events_count].values[value_count++] = imu_data->pose_imu.rotation.x;
    output_events[*output_events_count].values[value_count++] = imu_data->pose_imu.rotation.y;
    output_events[*output_events_count].values[value_count++] = imu_data->pose_imu.rotation.z;
    output_events[*output_events_count].values[value_count++] = imu_data->pose_imu.rotation.w;
    output_events[*output_events_count].values[value_count++] = imu_data->pose_mag.rotation.x;
    output_events[*output_events_count].values[value_count++] = imu_data->pose_mag.rotation.y;
    output_events[*output_events_count].values[value_count++] = imu_data->pose_mag.rotation.z;

    output_events[*output_events_count].values_count = value_count;
    (*output_events_count)++;
}

float degrees_to_radians(float angle_in_degrees)
{
    return 0.01745329252 * angle_in_degrees;
}
float radians_to_degrees(float angle_in_radians)
{
    return 57.295779 * angle_in_radians;
}

void imu_update_accelerometer(imu_data_t *imu_data, nst_event_t event, nst_event_t *output_events, int *output_events_count)
{
    imu_data->acc_sample = v3_norm(vec3(event.values[0], event.values[1], event.values[2]));
}

quaternion_t quaternion_set_sign_like_example(quaternion_t q, quaternion_t example)
{
    if (quaternion_norm(quaternion_subtract(q, example)) < quaternion_norm(quaternion_subtract(quaternion_negative(q), example)))
    {
        return q;
    }
    else
    {
        return quaternion_negative(q);
    }
}

float compare_pitch_and_roll(quaternion_t q_mag, quaternion_t q_other){
    float heading_mag = heading_from_quaternion(q_mag);
    float heading_other = heading_from_quaternion(q_other);
    //rotate q_mag to game rotation and compare angle
    quaternion_t q_mag_rotated = quaternion_multiply(quaternion_from_heading_pitch_roll(heading_other - heading_mag,0,0),q_mag);
    return radians_to_degrees(quaternion_angle(quaternion_multiply(q_mag_rotated, quaternion_inverse(q_other))));

}

void imu_update_magnetic_field(imu_data_t *imu_data, nst_event_t event, nst_event_t *output_events, int *output_events_count)
{
    vec3_t mag_raw = vec3(event.values[0], event.values[1], event.values[2]);

    vec3_t mag_unaligned = v3_mul(imu_data->mag_scale, v3_sub(mag_raw, imu_data->mag_offset));

    vec3_t mag_aligned;
    quaternion_rotate_vec3(quaternion_from_hpr(imu_data->mag_alignment_hpr), mag_unaligned, &mag_aligned);

    vec3_t down_device_frame = imu_data->acc_sample;

    vec3_t right_device_frame = v3_norm(v3_cross(down_device_frame, mag_aligned));

    vec3_t forward_device_frame = v3_norm(v3_cross(right_device_frame, down_device_frame));

    float heading = -90 + radians_to_degrees(atan2(forward_device_frame.x, forward_device_frame.y));
    float roll = atan2(down_device_frame.y,  sqrt(down_device_frame.x * down_device_frame.x + down_device_frame.z * down_device_frame.z)) * 180 / M_PI;
    float pitch = atan2(-down_device_frame.x, sqrt(down_device_frame.y * down_device_frame.y + down_device_frame.z * down_device_frame.z)) * 180 / M_PI;
    vec3_t hpr_mag = vec3(heading, pitch, roll);
    vec3_t hpr_gyro = heading_pitch_roll_from_quaternion(imu_data->pose_gyro.rotation);

    imu_data->pose_mag.rotation = quaternion_set_sign_like_example(quaternion_from_heading_pitch_roll(hpr_mag.x, hpr_mag.y, hpr_mag.z), imu_data->pose_imu.rotation);

    //mag error
    output_events[*output_events_count].timestamp = event.timestamp;
    output_events[*output_events_count].id = 2001;
    int value_count = 0;
    output_events[*output_events_count].values[value_count++] = compare_pitch_and_roll(imu_data->pose_mag.rotation, imu_data->pose_gyro.rotation);
    output_events[*output_events_count].values[value_count++] = hpr_mag.x;
    output_events[*output_events_count].values[value_count++] = hpr_mag.y;
    output_events[*output_events_count].values[value_count++] = hpr_mag.z;
    output_events[*output_events_count].values[value_count++] = hpr_gyro.x;
    output_events[*output_events_count].values[value_count++] = hpr_gyro.y;
    output_events[*output_events_count].values[value_count++] = hpr_gyro.z;
    output_events[*output_events_count].values_count = value_count;
    (*output_events_count)++;

    //kalman update
    if (imu_data->imu_update_time == 0)
    {
        //initialize imu
        imu_data->pose_imu.rotation = imu_data->pose_mag.rotation;
        // imu_data->pose_gyro.rotation = imu_data->pose_mag.rotation;
        double x[3];
        x[0] = (double)imu_data->pose_imu.rotation.x;
        x[1] = imu_data->pose_imu.rotation.y;
        x[2] = imu_data->pose_imu.rotation.z;
        imu_ekf_init(&(imu_data->imu),imu_data->imu_meas_noise, x);
        imu_data->imu_update_time = event.timestamp;
    }

    if (event.timestamp - imu_data->imu_update_time > 1e3 * imu_data->imu_mag_update_interval)
    {
        imu_data->imu_update_time = event.timestamp;
        double z[3];
        z[0] = imu_data->pose_mag.rotation.x;
        z[1] = imu_data->pose_mag.rotation.y;
        z[2] = imu_data->pose_mag.rotation.z;
    
        // for(int j = 0; j<3; j++){
        //     imu_data->imu.Q[j][j] = imu_data->imu_meas_noise;
        // }
        imu_ekf_update(&(imu_data->imu), z);
        output_events[*output_events_count].timestamp = event.timestamp;
        output_events[*output_events_count].id = 2002;
        value_count = 0;
        output_events[*output_events_count].values[value_count++] = quaternion_angle(quaternion_multiply(imu_data->pose_mag.rotation, quaternion_inverse(imu_data->pose_imu.rotation)));
        output_events[*output_events_count].values[value_count++] = imu_data->pose_mag.rotation.x;
        output_events[*output_events_count].values[value_count++] = imu_data->pose_mag.rotation.y;
        output_events[*output_events_count].values[value_count++] = imu_data->pose_mag.rotation.z;
        output_events[*output_events_count].values[value_count++] = imu_data->pose_imu.rotation.x;
        output_events[*output_events_count].values[value_count++] = imu_data->pose_imu.rotation.y;
        output_events[*output_events_count].values[value_count++] = imu_data->pose_imu.rotation.z;
        output_events[*output_events_count].values_count = value_count;
        (*output_events_count)++;
    }
    else
    {
        imu_data->imu.x[0] = imu_data->pose_imu.rotation.x;
        imu_data->imu.x[1] = imu_data->pose_imu.rotation.y;
        imu_data->imu.x[2] = imu_data->pose_imu.rotation.z;
    }
}

vec3_t heading_pitch_roll_from_quaternion(quaternion_t q)
{
    quaternion_t qin = quaternion_normalized(q);
    vec3_t ret;

    double sqw = qin.w * qin.w;
    double sqx = qin.x * qin.x;
    double sqy = qin.y * qin.y;
    double sqz = qin.z * qin.z;

    ret.x = radians_to_degrees(atan2(2.0 * (qin.x * qin.y + qin.z * qin.w), (sqx - sqy - sqz + sqw)));
    ret.y = radians_to_degrees(asin(-2.0 * (qin.x * qin.z - qin.y * qin.w) / (sqx + sqy + sqz + sqw)));
    ret.z = radians_to_degrees(atan2(2.0 * (qin.y * qin.z + qin.x * qin.w), (-sqx - sqy + sqz + sqw)));

    return ret;
}

quaternion_t quaternion_from_heading_pitch_roll(float heading_degrees, float pitch_degrees, float roll_degrees)
{
    float cang1 = cos(degrees_to_radians(heading_degrees) / 2.0);
    float sang1 = sin(degrees_to_radians(heading_degrees) / 2.0);
    float cang2 = cos(degrees_to_radians(pitch_degrees) / 2.0);
    float sang2 = sin(degrees_to_radians(pitch_degrees) / 2.0);
    float cang3 = cos(degrees_to_radians(roll_degrees) / 2.0);
    float sang3 = sin(degrees_to_radians(roll_degrees) / 2.0);

    // ZYX
    return quaternion(cang1 * cang2 * sang3 - sang1 * sang2 * cang3,
                      cang1 * sang2 * cang3 + sang1 * cang2 * sang3,
                      sang1 * cang2 * cang3 - cang1 * sang2 * sang3,
                      cang1 * cang2 * cang3 + sang1 * sang2 * sang3);
}

quaternion_t quaternion_from_hpr(vec3_t hpr)
{
    return quaternion_from_heading_pitch_roll(hpr.x, hpr.y, hpr.z);
}

double heading_from_quaternion(quaternion_t q)
{
    vec3_t hpr = heading_pitch_roll_from_quaternion(q);
    return hpr.x;
}

void imu_update(imu_data_t *imu_data, const nst_event_t input_event, nst_event_t output_events[4], int *output_events_count)
{
    nst_event_t event;

    int events_count_to_process = *output_events_count;

    for (int i = -1; i < events_count_to_process; i++)
    {
        if (i == -1)
        {
            event = input_event;
        }
        else
        {
            event = output_events[i];
        }

        switch (event.id)
        {
        case SENSOR_TYPE_ACCELEROMETER:
            imu_update_accelerometer(imu_data, event, output_events, output_events_count);
            break;
        case SENSOR_TYPE_MAGNETIC_FIELD:
            imu_update_magnetic_field(imu_data, event, output_events, output_events_count);
            break;
        case SENSOR_TYPE_GYROSCOPE:
            imu_update_gyro(imu_data, event, output_events, output_events_count);
            break;
        }
    }
}
