//=====================================================================================================
// MadgwickAHRS.h
//=====================================================================================================
//
// Implementation of Madgwick's IMU and AHRS algorithms.
// See: http://www.x-io.co.uk/node/8#open_source_ahrs_and_imu_algorithms
//
// Date			Author          Notes
// 29/09/2011	SOH Madgwick    Initial release
// 02/10/2011	SOH Madgwick	Optimised for reduced CPU load
// 2018         Tyler           Changed volatile parameters to input struct
//=====================================================================================================
#ifndef MadgwickAHRS_h
#define MadgwickAHRS_h

#include "../quaternion/quaternion.h"

//---------------------------------------------------------------------------------------------------
// Function declarations

void MadgwickAHRSupdate(float gx, float gy, float gz, float ax, float ay, float az, float mx, float my, float mz, float delta_time, float algorithm_gain, float rate_duration, quaternion_t *q);
void MadgwickAHRSupdateIMU(float gx, float gy, float gz, float ax, float ay, float az, float delta_time, float algorithm_gain, quaternion_t *q);

#endif
//=====================================================================================================
// End of file
//=====================================================================================================
