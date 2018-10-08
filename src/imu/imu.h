#ifndef IMU_H
#define IMU_H
#include "../nst_main.h"

void imu_init(imu_data_t *imu_data);

void imu_update(imu_data_t *imu_data, nst_event_t input_event, nst_event_t output_events[4], int *output_events_count);

#endif