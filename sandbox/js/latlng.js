function enu_to_latlng(x, y, z, origin_lat, origin_lng, origin_altitude) {

    // constants defined by WGS84 (in m)
    var a = 6378137.0;
    var f = 0.00335281066474748;
    var b = a * (1 - f);
    var e = Math.sqrt(Math.pow(1 - (b / a), 2));

    var origin_lat_radians = origin_lat * Math.PI / 180;
    var origin_lng_radians = origin_lng * Math.PI / 180;

    var N = a / Math.sqrt(1 - Math.pow(e, 2) * Math.pow(Math.sin(origin_lat_radians), 2));
    var M = a * (1 - Math.pow(e, 2)) / (1 - Math.pow(e, 2) * Math.pow(Math.pow(Math.sin(origin_lat_radians), 2), 1.5));

    var longitude = (x / ((N + origin_altitude) * (Math.cos(origin_lat_radians))) + origin_lng_radians) * 180 / Math.PI;
    var latitude = (y / (M + origin_altitude) + origin_lat_radians) * 180 / Math.PI;
    var altitude = z;

    return {
        "lat": latitude,
        "lng": longitude,
        "altitude": altitude
    }
}

function latlng_to_enu(latitude, longitude, altitude, origin_lat, origin_lng, origin_altitude) {
    // constants defined by WGS84 (in m)
    var a = 6378137.0;
    var f = 0.00335281066474748;
    var b = a * (1 - f);
    var e = Math.sqrt(Math.pow(1 - (b / a), 2));

    var latitude_radians = latitude * Math.PI / 180;
    var longitude_radians = longitude * Math.PI / 180;

    var origin_lat_radians = origin_lat * Math.PI / 180;
    var origin_lng_radians = origin_lng * Math.PI / 180;

    var N = a / Math.sqrt(1 - Math.pow(e, 2) * Math.pow(Math.sin(origin_lat_radians), 2));
    var M = a * (1 - Math.pow(e, 2)) / (1 - Math.pow(e, 2) * Math.pow(Math.pow(Math.sin(origin_lat_radians), 2), 1.5));

    var x = (longitude_radians - origin_lng_radians) * (N + origin_altitude) * Math.cos(origin_lat_radians);
    var y = (latitude_radians - origin_lat_radians) * (M + origin_altitude);
    var z = altitude;

    return ({
        "east": x,
        "north": y,
        "up": z
    })
}

function marylandstate_to_latlng(enu_point) {

    origin_lat = 39.133254230944445;
    origin_lng = -77.217273894750008;
    origin_altitude = 135.0461224;
    origin_north = 162821.3588;
    origin_east = 381214.4695;

    return enu_to_latlng(enu_point.east - origin_east, enu_point.north - origin_north, enu_point.up, origin_lat, origin_lng, origin_altitude);

}

function latlng_to_marylandstate(latlng_point) {

    origin_lat = 39.133254230944445;
    origin_lng = -77.217273894750008;
    origin_altitude = 135.0461224;
    origin_north = 162821.3588;
    origin_east = 381214.4695;

    enu_md = latlng_to_enu(latlng_point.lat, latlng_point.lng, latlng_point.altitude, origin_lat, origin_lng, origin_altitude);

    enu_md.east += origin_east;
    enu_md.north += origin_north;
    return enu_md;
}
