#include "nst_main.h"
#include "imu/imu.h"

void algorithm_init()
{
    imu_init(&nst_data.imu_data);
}

void algorithm_update(const nst_event_t input_event, nst_event_t output_events[4], int *output_events_count)
{
    imu_update(&nst_data.imu_data,input_event,output_events,output_events_count);
}
