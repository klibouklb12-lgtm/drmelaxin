import { db } from "@/lib/db";

async function main() {
  const rows = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  console.log(JSON.stringify(rows, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
