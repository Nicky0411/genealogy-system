import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const seedDir = join(process.cwd(), "database", "seed");
mkdirSync(seedDir, { recursive: true });

const now = new Date().toISOString();
const surnames = ["林", "陈", "王", "李", "张", "刘", "赵", "周", "吴", "郑"];
const givenNames = ["明", "华", "安", "宁", "德", "志", "文", "雅", "清", "远", "诚", "若", "思", "成", "言", "秋"];
const places = ["杭州", "苏州", "泉州", "福州", "南京", "广州", "成都", "长沙", "武汉", "宁波"];
const familyTargets = [52000, 6000, 6000, 6000, 6000, 6000, 6000, 6000, 6000, 6000];

let memberId = 1;

function csvValue(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function row(values) {
  return values.map(csvValue).join(",");
}

function randomOf(items, index) {
  return items[index % items.length];
}

function makeName(surname, index, gender) {
  const first = randomOf(givenNames, index);
  const second = randomOf(givenNames, index * 7 + (gender === "M" ? 1 : 3));
  return `${surname}${first}${second}`;
}

const users = [
  row(["user_id", "username", "password_hash", "email", "created_at", "updated_at"]),
  row([1, "admin", "$2a$10$3FplqNbu22kEpC1sRenN3ehvPRvXgJtbxsLhJG7u9JmAeRyFKOomq", "admin@example.com", now, now]),
  row([2, "guest", "$2a$10$YY5QOuB0xHx/ivnWno.taO6RgqI14jhlyUg5Ngf0ijoVMgwEs.Rqa", "guest@example.com", now, now])
];

const families = [
  row(["family_id", "family_name", "surname", "description", "created_by", "created_at", "updated_at"])
];

const familyUsers = [
  row(["family_id", "user_id", "role", "joined_at"])
];

const members = [
  row([
    "member_id",
    "family_id",
    "name",
    "gender",
    "birth_year",
    "death_year",
    "generation",
    "father_id",
    "mother_id",
    "spouse_id",
    "birthplace",
    "biography",
    "created_at",
    "updated_at"
  ])
];

function pushMember({
  familyId,
  surname,
  gender,
  birthYear,
  generation,
  fatherId = "",
  motherId = "",
  spouseId = "",
  index
}) {
  const id = memberId++;
  const deathYear = birthYear < 1955 ? birthYear + 58 + (index % 35) : "";
  members.push(
    row([
      id,
      familyId,
      makeName(surname, index, gender),
      gender,
      birthYear,
      deathYear,
      generation,
      fatherId,
      motherId,
      spouseId,
      randomOf(places, familyId + index),
      `第${generation}代成员`,
      now,
      now
    ])
  );
  return id;
}

function setSpouse(memberRowIndex, spouseId) {
  const columns = members[memberRowIndex].split(",");
  columns[9] = String(spouseId);
  members[memberRowIndex] = columns.join(",");
}

function buildGenerationCounts(target) {
  const counts = [0, 2];
  const remaining = target - 2;
  const weights = Array.from({ length: 29 }, (_, index) => index + 2);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let assigned = 0;

  for (let generation = 2; generation <= 30; generation += 1) {
    const weight = weights[generation - 2];
    const count = Math.max(2, Math.floor((remaining * weight) / totalWeight));
    counts[generation] = count;
    assigned += count;
  }

  let gap = target - 2 - assigned;
  let generation = 30;
  while (gap > 0) {
    counts[generation] += 1;
    gap -= 1;
    generation -= 1;
    if (generation < 2) generation = 30;
  }

  return counts;
}

function pairGeneration(children, familyId) {
  const males = children.filter((child) => child.gender === "M");
  const females = children.filter((child) => child.gender === "F");
  const couples = [];
  const coupleCount = Math.min(males.length, females.length);

  for (let i = 0; i < coupleCount; i += 1) {
    const male = males[i];
    const female = females[(i + familyId) % females.length];
    setSpouse(male.rowIndex, female.id);
    setSpouse(female.rowIndex, male.id);
    couples.push([male.id, female.id]);
  }

  return couples;
}

for (let familyIndex = 0; familyIndex < familyTargets.length; familyIndex += 1) {
  const familyId = familyIndex + 1;
  const surname = surnames[familyIndex];
  const target = familyTargets[familyIndex];

  families.push(row([familyId, `${surname}氏族谱`, surname, `${surname}氏三十代模拟族谱`, 1, now, now]));
  familyUsers.push(row([familyId, 1, "owner", now]));

  const founderMaleRow = members.length;
  const founderMale = pushMember({
    familyId,
    surname,
    gender: "M",
    birthYear: 1120 + familyIndex,
    generation: 1,
    index: memberId
  });
  const founderFemaleRow = members.length;
  const founderFemale = pushMember({
    familyId,
    surname,
    gender: "F",
    birthYear: 1122 + familyIndex,
    generation: 1,
    index: memberId
  });
  setSpouse(founderMaleRow, founderFemale);
  setSpouse(founderFemaleRow, founderMale);

  const generationCounts = buildGenerationCounts(target);
  let parentCouples = [[founderMale, founderFemale]];

  for (let generation = 2; generation <= 30; generation += 1) {
    const children = [];
    const planned = generationCounts[generation];

    for (let i = 0; i < planned; i += 1) {
      const [fatherId, motherId] = parentCouples[i % parentCouples.length];
      const gender = (i + generation + familyId) % 2 === 0 ? "M" : "F";
      const child = pushMember({
        familyId,
        surname,
        gender,
        birthYear: 1120 + familyIndex + (generation - 1) * 27 + (i % 5),
        generation,
        fatherId,
        motherId,
        index: memberId + i
      });
      children.push({ id: child, gender, rowIndex: members.length - 1 });
    }

    const nextCouples = pairGeneration(children, familyId);
    parentCouples = nextCouples.length > 0 ? nextCouples : parentCouples;
  }
}

writeFileSync(join(seedDir, "users.csv"), `${users.join("\n")}\n`);
writeFileSync(join(seedDir, "families.csv"), `${families.join("\n")}\n`);
writeFileSync(join(seedDir, "family_users.csv"), `${familyUsers.join("\n")}\n`);
writeFileSync(join(seedDir, "members.csv"), `${members.join("\n")}\n`);

console.log(`Generated ${members.length - 1} members across ${familyTargets.length} families.`);
