// Previous code above

// Validation for customer coordinates
if (!customer.coordinates || !customer.coordinates.lat || !customer.coordinates.lng) {
    console.error('Missing customer coordinates.');
    return;
}

// Call getDistanceKm only if coordinates are valid
const distance = getDistanceKm(customer.coordinates.lat, customer.coordinates.lng);
// Previous code below

// Fixing the check for both lat and lng properties
if (!customer.coordinates.lat || !customer.coordinates.lng) {
    console.error('Both latitude and longitude are required.');
    return;
}