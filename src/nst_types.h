#ifndef NST_TYPES_H
#define NST_TYPES_H
#include <float.h>
#include <math.h>
#include "math3d/math_3d.h"
#include "quaternion/quaternion.h"

typedef struct {
    double timestamp;
    unsigned int id;
    int values_count;
    double values[16];
} nst_event_t;

typedef struct
{
    quaternion_t rotation;
    vec3_t position;
    double timestamp;
} pose_t;

typedef struct
{
    int sample_count;
    float delta_time;

    float madgwick_gain;
    float angularrate_mag;

    vec3_t gyro_sample;
    vec3_t gyro_offset; 
    vec3_t gyro_scale; 
    float gyro_scale_factor;

    vec3_t acc_sample;
    vec3_t acc_offset; 
    vec3_t acc_scale; 

    vec3_t mag_sample;
    vec3_t mag_offset; 
    vec3_t mag_scale;

    pose_t pose_imu;
} imu_data_t;

typedef struct {
    imu_data_t imu_data;
} nst_data_t;

enum {
    SENSOR_TYPE_ACCELEROMETER = 1,
    SENSOR_TYPE_MAGNETIC_FIELD = 2,
    SENSOR_TYPE_GYROSCOPE = 4,
};


#endif