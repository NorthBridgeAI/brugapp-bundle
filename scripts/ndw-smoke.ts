import { loadCatalog } from "../src/lib/catalog";
import { fetchGzipXml, NDW_FEEDS } from "../src/lib/ndw";
import {
  isTerneuzenComplexRecord,
  mapRecordsToBridges,
  mapTerneuzenCrossings,
  parseBridgeSwingRecords,
} from "../src/lib/ndw-parse";
import { loadTerneuzenCrossings } from "../src/lib/terneuzen";

async function main() {
  const catalog = loadCatalog();
  const now = new Date();
  const [actueel, planning] = await Promise.all([
    fetchGzipXml(NDW_FEEDS.actueel),
    fetchGzipXml(NDW_FEEDS.planning),
  ]);
  const records = [
    ...parseBridgeSwingRecords(actueel),
    ...parseBridgeSwingRecords(planning),
  ];
  const hits = mapRecordsToBridges(records, catalog.bridges, now);
  const crossings = mapTerneuzenCrossings(
    records,
    loadTerneuzenCrossings(),
    now,
  );
  const sample = records.filter(
    (record) =>
      record.isrs === "NLTNZ001300522000264" ||
      record.isrs === "NLSVG001300521600186" ||
      isTerneuzenComplexRecord(record),
  );
  console.log(
    JSON.stringify(
      {
        at: now.toISOString(),
        actueelRecords: parseBridgeSwingRecords(actueel).length,
        planningRecords: parseBridgeSwingRecords(planning).length,
        mapped: hits,
        crossings,
        sample,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
