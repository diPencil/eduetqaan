import db from './src/models/index.js';
async function seed() {
  const models = await db;
  // Use MySQL model directly so it becomes the source of truth
  const FaqModel = models.FaqMysql || models.Faq;
  
  await FaqModel.create({
    questionText: 'كيف يمكنني استرجاع كلمة المرور الخاصة بي؟',
    answerText: 'يمكنك استرجاع كلمة المرور من خلال الضغط على خيار "نسيت كلمة المرور" في صفحة الدخول، وستصلك رسالة على الواتساب أو الإيميل الخاص بك برابط إعادة التعيين.',
    category: 'عام',
    level: 'الكل',
    status: 'published',
    orderIndex: 1
  });
  
  await FaqModel.create({
    questionText: 'متى يتم تفعيل الكود الخاص بي للمنصة؟',
    answerText: 'يتم تفعيل الكود بمجرد شرائه وإدخاله في الخانة المخصصة في المنصة، الصلاحية تبدأ فور التفعيل.',
    category: 'الاشتراكات',
    level: 'الكل',
    status: 'published',
    orderIndex: 2
  });
  
  console.log("Seeded FAQs in MySQL successfully.");
  process.exit(0);
}
seed();
