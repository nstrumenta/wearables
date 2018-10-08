#include "imu.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include "../Madgwick/MadgwickAHRS.h"

//#define DEBUG_EVENTS

void imu_init(imu_data_t *imu_data)
{
    imu_data->madgwick_gain = 0.01;

    imu_data->angularrate_mag = 0.01;

    imu_data->acc_sample = vec3(0, 0, 0);
    imu_data->acc_offset = vec3(0, 0, 0);
    imu_data->acc_scale = vec3(1, 1, 1);

    imu_data->gyro_sample = vec3(0, 0, 0);
    imu_data->gyro_offset = vec3(0, 0, 0);
    imu_data->gyro_scale = vec3(1, 1, 1);

    imu_data->mag_sample = vec3(0, 0, 0);
    imu_data->mag_offset = vec3(0, 0, 0);
    imu_data->mag_scale = vec3(1, 1, 1);

    imu_data->pose_imu.rotation = quaternion(0, 0, 0, 1);
    imu_data->pose_imu.position = vec3(0, 0, 0);
    imu_data->pose_imu.timestamp = 0;
}

void imu_update_accelerometer(imu_data_t *imu_data, nst_event_t event, nst_event_t *output_events, int *output_events_count)
{
    imu_data->acc_sample = v3_mul(imu_data->acc_scale,v3_sub(vec3(event.values[0], event.values[1], event.values[2]),imu_data->acc_offset));
}

void imu_update_magnetic_field(imu_data_t *imu_data, nst_event_t event, nst_event_t *output_events, int *output_events_count)
{
    imu_data->mag_sample = v3_mul(imu_data->mag_scale,v3_sub(vec3(event.values[0], event.values[1], event.values[2]),imu_data->mag_offset));
}

void imu_update_gyro(imu_data_t *imu_data, nst_event_t event, nst_event_t *output_events, int *output_events_count)
{
    imu_data->gyro_sample = v3_muls(v3_mul(imu_data->gyro_scale,v3_sub(vec3(event.values[0], event.values[1], event.values[2]),imu_data->gyro_offset)), 0.00122);

    if (imu_data->pose_imu.timestamp == 0)
    {
        imu_data->pose_imu.timestamp = event.timestamp;
    }
    float delta_time = 1e-3 * (event.timestamp - imu_data->pose_imu.timestamp);
    imu_data->pose_imu.timestamp = event.timestamp;

    MadgwickAHRSupdate(imu_data->gyro_sample.x,
                       imu_data->gyro_sample.y,
                       imu_data->gyro_sample.z,
                       imu_data->acc_sample.x,
                       imu_data->acc_sample.y,
                       imu_data->acc_sample.z,
                       imu_data->mag_sample.x,
                       imu_data->mag_sample.y,
                       imu_data->mag_sample.z,
                       delta_time,
                       imu_data->madgwick_gain,
                       imu_data->angularrate_mag,
                       &(imu_data->pose_imu.rotation));

    //output pose
    output_events[*output_events_count].timestamp = imu_data->pose_imu.timestamp;
    output_events[*output_events_count].id = 2000;
    output_events[*output_events_count].values_count = 7;
    output_events[*output_events_count].values[0] = imu_data->pose_imu.rotation.x;
    output_events[*output_events_count].values[1] = imu_data->pose_imu.rotation.y;
    output_events[*output_events_count].values[2] = imu_data->pose_imu.rotation.z;
    output_events[*output_events_count].values[3] = imu_data->pose_imu.rotation.w;
    output_events[*output_events_count].values[4] = imu_data->pose_imu.position.x;
    output_events[*output_events_count].values[5] = imu_data->pose_imu.position.y;
    output_events[*output_events_count].values[6] = imu_data->pose_imu.position.z;
    (*output_events_count)++;

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
