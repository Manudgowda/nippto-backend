const { io } = require('socket.io-client');

const RIDER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYzZWI2ZDk2LWNiNGQtNDczMS04YjY4LWM2OGI2YTA1NTJhOSIsInBob25lIjoiNjY2NjY2NjY2NiIsInR5cGUiOiJ1c2VyIiwiaWF0IjoxNzc0MDI2NDMwLCJleHAiOjE3NzY2MTg0MzB9.2f8czUCCzxF9sdvMlMAQYkxJdnDUX4BkPInJKfWsT24';
const DRIVER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZkZWFiN2JmLWQzNDktNDkzNy04YzdjLTMwNzRkODJlZmY1NSIsInBob25lIjoiNTU1NTU1NTU1NSIsInR5cGUiOiJkcml2ZXIiLCJpYXQiOjE3NzQwMjY1MDQsImV4cCI6MTc3NjYxODUwNH0.iYjoDlXomDtc8brXmGe4Rm3fPtmhn7LEY1LmjItHAAE';

console.log('🧪 Starting Nippto Socket Test...\n');

const driverSocket = io('http://localhost:5000', {
  auth: { token: DRIVER_TOKEN }
});

driverSocket.on('connect', () => {
  console.log('🚗 Driver connected to socket:', driverSocket.id);
  driverSocket.emit('driver:toggle_status', {
    is_online: true,
    latitude: 13.3379,
    longitude: 76.6191
  });
});

driverSocket.on('driver:status_updated', (data) => {
  console.log('✅ Driver status:', data.message);
});

driverSocket.on('ride:new_request', (data) => {
  console.log('\n🔔 NEW RIDE REQUEST RECEIVED BY DRIVER!');
  console.log('Ride ID:', data.ride_id);
  console.log('From:', data.pickup_address);
  console.log('To:', data.drop_address);
  console.log('Fare: ₹', data.fare);
  setTimeout(() => {
    console.log('\n✅ Driver accepting ride...');
    driverSocket.emit('driver:accept_ride', { ride_id: data.ride_id });
  }, 2000);
});

driverSocket.on('ride:accepted_confirmed', (data) => {
  console.log('\n🎉 DRIVER: Ride accepted confirmed!');
  console.log('Pickup:', data.pickup_address);
  console.log('OTP to confirm:', data.otp);
});

setTimeout(() => {
  const riderSocket = io('http://localhost:5000', {
    auth: { token: RIDER_TOKEN }
  });

  riderSocket.on('connect', () => {
    console.log('\n👤 Rider connected to socket:', riderSocket.id);
    setTimeout(() => {
      console.log('\n📍 Rider requesting ride...');
      riderSocket.emit('rider:request_ride', {
        pickup_lat: 13.3379,
        pickup_lng: 76.6191,
        pickup_address: 'Bus Stand, Sira',
        drop_lat: 13.3580,
        drop_lng: 76.6320,
        drop_address: 'Town Hall, Sira',
        vehicle_type: 'bike'
      });
    }, 1000);
  });

  riderSocket.on('ride:requested', (data) => {
    console.log('\n✅ RIDER: Ride requested!');
    console.log('Ride ID:', data.ride_id);
    console.log('Fare: ₹', data.fare);
    console.log('OTP:', data.otp);
  });

  riderSocket.on('ride:driver_assigned', (data) => {
    console.log('\n🎉 RIDER: Driver found!');
    console.log('Driver:', data.driver.name);
    console.log('Vehicle:', data.driver.vehicle_number);
  });

  riderSocket.on('ride:no_driver', (data) => {
    console.log('\n❌ RIDER:', data.message);
  });

}, 3000);