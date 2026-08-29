const { buildCustomerProfile } = require('../models/User');

describe('buildCustomerProfile', () => {
  it('normalizes persisted user details into the delivery profile expected by the agent', () => {
    const user = {
      name: 'Asha Verma',
      email: 'asha@example.com',
      profile: {
        fullName: 'Asha Verma',
        phone: '9876543210',
        email: 'asha@example.com',
        street: '12 Main Street',
        building: 'B-402',
        landmark: 'Near Metro Station',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
      },
    };

    const profile = buildCustomerProfile(user);

    expect(profile).toMatchObject({
      fullName: 'Asha Verma',
      phone: '9876543210',
      email: 'asha@example.com',
      street: '12 Main Street',
      building: 'B-402',
      landmark: 'Near Metro Station',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      address: '12 Main Street, B-402, Near Metro Station',
    });
  });
});
