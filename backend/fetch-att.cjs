const axios = require('axios');
const jwt = require('jsonwebtoken');

const token = jwt.sign({ id: 1, role: 'admin' }, 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET', { expiresIn: '1h' });

axios.get('http://localhost:12011/api/v1/students/admin/2/attendance', {
  headers: {
    Authorization: `Bearer ${token}`
  }
}).then(res => {
  console.log(JSON.stringify(res.data.data, null, 2));
}).catch(err => {
  console.error(err.response ? err.response.data : err.message);
});
