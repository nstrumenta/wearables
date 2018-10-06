#ifndef NST_TYPES_H
#define NST_TYPES_H
#include <float.h>
#include <math.h>
#include "math3d/math_3d.h"
#include "quaternion/quaternion.h"

//tiny ekf struct
#include "tiny_ekf/tiny_ekf_config.h"


typedef struct {
    double timestamp;
    unsigned int id;
    int values_count;
    double values[16];
} nst_event_t;

typedef struct
{
    double rotation;
    double x_offset;
    double y_offset;
    double scale;
} fit_params_t;

typedef struct
{
    double lat;
    double lng;
    double height;
} latlng_t;

typedef struct
{    
    latlng_t origin;
    quaternion_t rotation;
    vec3_t position;
    double timestamp;
} pose_t;

typedef struct
{
    int sample_count;
    double delta_time;

    float madgwick_gain;
    float angularrate_mag;

    double gyro_sample_time;
    vec3_t gyro_sample;
    double gyro_scale_factor;

    vec3_t acc_sample;

    // ekf_t imu;
    // double imu_update_time;


    // double imu_meas_noise;
    // double imu_mag_update_interval;
    vec3_t mag_sample;
    vec3_t mag_offset; 
    vec3_t mag_scale;
    vec3_t mag_alignment_hpr;
    double mag_declination; 

    // vec3_t gyro_offset; 
    // vec3_t gyro_scale; 
    // vec3_t gyro_alignment_hpr;

    // vec3_t acc_offset; 
    // vec3_t acc_scale; 
    // vec3_t acc_alignment_hpr;

    // pose_t pose_imu;
    // pose_t pose_gyro;
    // pose_t pose_mag;

    // double previous_rotation_time;
} imu_data_t;

typedef struct {
    imu_data_t imu_data;
} nst_data_t;

enum {
    SENSOR_TYPE_META_DATA = 0,
    SENSOR_TYPE_ACCELEROMETER = 1,
    SENSOR_TYPE_MAGNETIC_FIELD = 2,
    SENSOR_TYPE_ORIENTATION = 3,
    SENSOR_TYPE_GYROSCOPE = 4,
    SENSOR_TYPE_LIGHT = 5,
    SENSOR_TYPE_PRESSURE = 6,
    SENSOR_TYPE_TEMPERATURE = 7,
    SENSOR_TYPE_PROXIMITY = 8,
    SENSOR_TYPE_GRAVITY = 9,
    SENSOR_TYPE_LINEAR_ACCELERATION = 10,
    SENSOR_TYPE_ROTATION_VECTOR = 11,
    SENSOR_TYPE_RELATIVE_HUMIDITY = 12,
    SENSOR_TYPE_AMBIENT_TEMPERATURE = 13,
    SENSOR_TYPE_MAGNETIC_FIELD_UNCALIBRATED = 14,
    SENSOR_TYPE_GAME_ROTATION_VECTOR = 15,
    SENSOR_TYPE_GYROSCOPE_UNCALIBRATED = 16,
    SENSOR_TYPE_SIGNIFICANT_MOTION = 17,
    SENSOR_TYPE_STEP_DETECTOR = 18,
    SENSOR_TYPE_STEP_COUNTER = 19,
    SENSOR_TYPE_GEOMAGNETIC_ROTATION_VECTOR = 20,
    SENSOR_TYPE_HEART_RATE = 21,
    SENSOR_TYPE_TILT_DETECTOR = 22,
    SENSOR_TYPE_WAKE_GESTURE = 23,
    SENSOR_TYPE_GLANCE_GESTURE = 24,
    SENSOR_TYPE_PICK_UP_GESTURE = 25,
    SENSOR_TYPE_WRIST_TILT_GESTURE = 26,
    SENSOR_TYPE_DEVICE_ORIENTATION = 27,
    SENSOR_TYPE_POSE_6DOF = 28,
    SENSOR_TYPE_STATIONARY_DETECT = 29,
    SENSOR_TYPE_MOTION_DETECT = 30,
    SENSOR_TYPE_HEART_BEAT = 31,
    SENSOR_TYPE_DYNAMIC_SENSOR_META = 32,
    SENSOR_TYPE_ADDITIONAL_INFO = 33,
    SENSOR_TYPE_LOW_LATENCY_OFFBODY_DETECT = 34,
    SENSOR_TYPE_ACCELEROMETER_UNCALIBRATED = 35,
    SENSOR_TYPE_DEVICE_PRIVATE_BASE = 65536, // 0x10000
    SENSOR_TYPE_GPS = 65666,
    SENSOR_TYPE_VEHICLE_DATA = 65667,
    SENSOR_TYPE_BLUECOIN = 3000,
    SENSOR_TYPE_FUSED_LOCATION_FIT_PARAMS = 301,
    SENSOR_TYPE_FUSED_LOCATION_PATH = 302,
    SENSOR_TYPE_TRUTH_POINT = 1002,
    SENSOR_TYPE_HEADING_ERROR = 1003,
    SENSOR_TYPE_FUSED_MAG = 1008,
    SENSOR_TYPE_FUSED_GYRO = 1009,
    SENSOR_TYPE_POSITION_ERROR = 1010,
    SENSOR_TYPE_FUSED_VDR = 1011,
};


#endif