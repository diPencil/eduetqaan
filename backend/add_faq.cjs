const axios = require('axios');

async function main() {
  try {
    // 1. Login
    const loginRes = await axios.post('http://localhost:12011/api/v1/users/login', {
      email: 'admin@etqan.com',
      password: 'Password123'
    });
    const token = loginRes.data.token;
    console.log('Logged in successfully!');

    // 2. Create FAQ
    const faqRes = await axios.post('http://localhost:12011/api/v1/faq', {
      questionText: 'كيف يمكنني استرجاع كلمة المرور الخاصة بي؟',
      answerText: 'يمكنك استرجاع كلمة المرور من خلال الضغط على خيار "نسيت كلمة المرور" في صفحة الدخول.',
      category: 'عام',
      level: 'الكل',
      status: 'published',
      orderIndex: 1
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('FAQ Created:', faqRes.data);

    // 3. Create another FAQ
    const faqRes2 = await axios.post('http://localhost:12011/api/v1/faq', {
      questionText: 'متى يتم تفعيل الكود الخاص بي للمنصة؟',
      answerText: 'يتم تفعيل الكود بمجرد شرائه وإدخاله في الخانة المخصصة في المنصة.',
      category: 'الاشتراكات',
      level: 'الكل',
      status: 'published',
      orderIndex: 2
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Second FAQ created:', faqRes2.data);

  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

main();
