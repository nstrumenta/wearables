#include "imu_ekf.h"
#include <math.h>

void imu_ekf_init(ekf_t * ekf, double meas_noise, double x[3])
{   
    ekf_init(ekf, Nsta, Mobs);

    for (int j=0; j<Nsta; ++j)
    {
        ekf->Q[j][j] = meas_noise;
    }
    // initial covariances of state noise, measurement noise
    double P0 = 0.5;
    double R0 = 0.5;

    int i;

    for (i=0; i<Mobs; ++i)
        ekf->P[i][i] = P0;

    for (i=0; i<Nsta; ++i)
        ekf->R[i][i] = R0;

    // quaternion x,y,z
    ekf->x[0] = x[0];
    ekf->x[1] = x[1];
    ekf->x[2] = x[2];
}

/*
Model:

xk=f(xk−1,uk)+wk 

zk=h(xk)+vk
Predict:
x̂ k=f(x̂ k−1,uk) 

Pk=Fk−1Pk−1FTk−1+Qk−1
Update:
Gk=PkHTk(HkPkHTk+R)−1 

x̂ k←x̂ k+Gk(zk−h(x̂ k)) 

Pk←(I−GkHk)Pk
*/

int imu_ekf_update(ekf_t * ekf, double z[3])
{ 
    //build model
    int j;

    // f
    for (j=0; j<3; j++) {
        ekf->fx[j] = ekf->x[j];
    }

    for (j=0; j<3; ++j){
        ekf->F[j][j] = 1;
    }

    // h
    for (j=0; j<3; ++j) {
        ekf->hx[j] = ekf->x[j];
    }

    for (j=0; j<3; ++j) {
        ekf->H[j][j] = 1;
    } 

    //predict and update
    return ekf_step(ekf,z);  
}

