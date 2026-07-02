import { getMysql, initDatabases } from './src/config/db.js';
import { defineCommunityQuestionModel } from './src/models/community.question.model.js';
import { defineCommunityAnswerModel } from './src/models/community.answer.model.js';

(async () => {
  await initDatabases();
  const sequelize = getMysql();
  
  const CommunityQuestionMysql = defineCommunityQuestionModel(sequelize);
  const CommunityAnswerMysql = defineCommunityAnswerModel(sequelize);
  
  try {
    const q1 = await CommunityQuestionMysql.create({
      studentId: 1,
      body: 'يا مستر لو سمحت، في الدرس التالت مش فاهم إزاي نطبق قانون نيوتن التاني في حالة وجود احتكاك؟ ممكن مثال توضيحي؟',
      status: 'open',
      isDeleted: false,
      createdAtLocal: new Date(),
      updatedAtLocal: new Date()
    });
    const q2 = await CommunityQuestionMysql.create({
      studentId: 2,
      body: 'عندي مشكلة في حل المسألة رقم 15 في الواجب، الناتج بيطلع معايا بالسالب دايماً، هل ده صح ولا في خطأ في التعويض؟',
      status: 'open',
      isDeleted: false,
      createdAtLocal: new Date(Date.now() - 2 * 3600000),
      updatedAtLocal: new Date(Date.now() - 2 * 3600000)
    });
    const q3 = await CommunityQuestionMysql.create({
      studentId: 1,
      body: 'هل في فرق بين السرعة المتجهة والسرعة القياسية في القوانين ولا الاتنين بنعوض بيهم بنفس الشكل في المعادلات؟',
      status: 'answered',
      isDeleted: false,
      createdAtLocal: new Date(Date.now() - 24 * 3600000),
      updatedAtLocal: new Date(Date.now() - 24 * 3600000)
    });
    const q4 = await CommunityQuestionMysql.create({
      studentId: 2,
      body: 'ممكن ملخص سريع لقوانين الحركة الدائرية عشان بتلخبط فيهم؟',
      status: 'closed',
      isDeleted: false,
      createdAtLocal: new Date(Date.now() - 72 * 3600000),
      updatedAtLocal: new Date(Date.now() - 72 * 3600000)
    });

    await CommunityAnswerMysql.create({
      questionId: q3.id,
      responderId: 1,
      responderRole: 'admin',
      contentText: 'أهلاً بك يا بطل! السرعة المتجهة بتحتاج اتجاه وقيمة عشان كده بنعوض عنها بإشارة (موجب/سالب) حسب الاتجاه، أما السرعة القياسية بناخد قيمتها بس بدون إشارة. في قوانين الحركة لو شغالين في خط مستقيم، يفضل نستخدم المتجهة عشان نراعي الاتجاهات لو الجسم عكس حركته. مرفق ملف بيوضح الفرق مع أمثلة محلولة.',
      attachments: [{kind: 'pdf', url: 'https://example.com/speed.pdf', title: 'شرح السرعة المتجهة والقياسية', mime: 'application/pdf'}],
      isDeleted: false,
      createdAtLocal: new Date(Date.now() - 5 * 3600000),
      updatedAtLocal: new Date(Date.now() - 5 * 3600000)
    });

    console.log("Success seeding MySQL");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
