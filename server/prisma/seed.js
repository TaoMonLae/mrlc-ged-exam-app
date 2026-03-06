const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function code(len=4) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

async function main() {
  const shouldSeed = (process.env.SEED_ADMIN || "true").toLowerCase() === "true";

  // Ensure schema exists (db push is done in Dockerfile CMD before seed)
  if (!shouldSeed) return;

  // Create admin if not exists
  const existing = await prisma.user.findUnique({ where: { username: "admin" } });
  if (!existing) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    await prisma.user.create({
      data: { username: "admin", passwordHash, role: "ADMIN" }
    });
    console.log("Seeded default admin: admin / admin123");
  }

  // Create a sample class if none exist
  const classCount = await prisma.class.count();
  if (classCount === 0) {
    await prisma.class.create({
      data: {
        name: "MRLC GED - Sample Class",
        classCode: `MRLC-${code(4)}`,
        allowAccountLogin: true,
        allowCodeLogin: true,
        codeModePolicy: "ROSTER_ONLY",
      }
    });
    console.log("Seeded sample class.");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
