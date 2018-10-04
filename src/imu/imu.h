#ifndef IMU_H
#define IMU_H
#include "../nst_main.h"

void imu_init(imu_data_t *imu_data);

void imu_update(imu_data_t *imu_data, nst_event_t input_event, nst_event_t output_events[4], int *output_events_count);

vec3_t heading_pitch_roll_from_quaternion(quaternion_t q);
quaternion_t quaternion_from_heading_pitch_roll(float heading, float pitch, float roll);
quaternion_t quaternion_from_hpr(vec3_t hpr);
double heading_from_quaternion(quaternion_t q);

#endif