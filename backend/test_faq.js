import { models } from './src/models/index.js';
async function test() {
  const FaqModel = models.Faq || models.FaqItem || models.FaqMysql;
  const all = await FaqModel.findAll();
  console.log("All:", all.map(x => x.toJSON()));
  const one = await FaqModel.findOne({ where: { id: 1, isDeleted: false } });
  console.log("One with isDeleted=false:", one ? one.toJSON() : null);
  const oneWithout = await FaqModel.findOne({ where: { id: 1 } });
  console.log("One without isDeleted:", oneWithout ? oneWithout.toJSON() : null);
  process.exit(0);
}
test();
