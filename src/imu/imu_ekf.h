#ifndef IMU_EKF_H
#define IMU_EKF_H
#include "../nst_main.h"
#include "../tiny_ekf/tiny_ekf.h"

void imu_ekf_init(ekf_t * ekf, double meas_noise, double x[3]);

int imu_ekf_update(ekf_t * ekf, double z[3]);

#endif