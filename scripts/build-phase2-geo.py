#!/usr/bin/env python3
"""Build Phase 2 geographic ground-truth GeoJSON from official Dutch extracts.

Reads /tmp/geo/*.json (RWS FIS, PDOK NWB, PDOK BGT) captured on 2026-09-14.
Does not invent geometry. OSM/A2 spans are written only as corroboration.
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/workspace")
SRC = Path("/tmp/geo")
OUT = ROOT / "src" / "data" / "geo"
RETRIEVED = "2026-09-14T08:58:37Z"
TODAY = "2026-09-14"

BBOX_LOCK = {
    "west": 3.8140,
    "south": 51.3255,
    "east": 3.8245,
    "north": 51.3375,
}

SOURCES = {
    "rws_fis": {
        "name": "Rijkswaterstaat Vaarwegen (FIS/VNDS) OGC API Features",
        "url": "https://geo.rijkswaterstaat.nl/services/ogc/gdr/fis_vnds/ogc/features/v1",
        "license": "Rijkswaterstaat open data (publieke OGC API)",
        "retrievedAt": RETRIEVED,
        "note": "Collections sluis_v, sluiskolk_v, brug, isrs_object. Polygon/point geometry as published; attributes length/width used where present.",
    },
    "nwb": {
        "name": "Nationaal Wegenbestand — Wegen (PDOK OGC API Features)",
        "url": "https://api.pdok.nl/rws/nationaal-wegenbestand-wegen/ogc/v1/collections/wegvakken",
        "license": "CC0 1.0",
        "retrievedAt": RETRIEVED,
        "note": "Wegvakken bbox Terneuzen Noordzeesluizen. FOW=4 + BST=NRB = roundabout carriageway (NDW NWB docs).",
        "serviceTimestamp": "2026-09-14T08:58:37Z",
    },
    "bgt": {
        "name": "Basisregistratie Grootschalige Topografie (PDOK OGC API Features)",
        "url": "https://api.pdok.nl/lv/bgt/ogc/v1",
        "license": "CC0 1.0",
        "retrievedAt": RETRIEVED,
        "datetimeFilter": RETRIEVED,
        "note": "Current objects only (status=bestaand, no eind_registratie). waterdeel, overbruggingsdeel, kunstwerkdeel_vlak, wegdeel.",
    },
    "rws_news": {
        "name": "Rijkswaterstaat nieuws — Nieuwe Sluis in Terneuzen koninklijk geopend",
        "url": "https://www.rijkswaterstaat.nl/nieuws/archief/2024/10/nieuwe-sluis-in-terneuzen-koninklijk-geopend",
        "published": "2024-10-11",
        "retrievedAt": TODAY,
        "note": "427 m × 55 m × 16.44 m; Middensluis (1910) replaced by Nieuwe Sluis; Westsluis + Oostsluis remain.",
    },
    "bam": {
        "name": "BAM Infra — Nieuwe Sluis Terneuzen project page",
        "url": "https://www.baminfra.nl/projecten/nieuwe-sluis-terneuzen",
        "retrievedAt": TODAY,
        "note": "Design: lock 427×55×16.44 m; two bridges 84 m long × 18 m wide. Used to corroborate BGT deck size, not as geometry source.",
    },
    "luchtfoto": {
        "name": "PDOK Actueel_orthoHR WMS (check only — not geometry truth)",
        "url": "https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0",
        "layer": "Actueel_orthoHR",
        "retrievedAt": TODAY,
        "bbox": [3.812, 51.325, 3.825, 51.338],
        "note": "Visual check of lock count, relative scale, roundabout, water. Photo vintage is the PDOK 'actueel' mosaic, not necessarily 2026.",
    },
}


def load(name: str) -> dict:
    return json.loads((SRC / name).read_text())


def write_fc(path: Path, features: list, *, name: str, source: dict, extra: dict | None = None):
    fc = {
        "type": "FeatureCollection",
        "name": name,
        "groundTruth": True,
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "source": source,
        "generatedAt": RETRIEVED,
        "featureCount": len(features),
        "features": features,
    }
    if extra:
        fc.update(extra)
    text = json.dumps(fc, ensure_ascii=False, indent=2) + "\n"
    path.write_text(text)
    if path.suffix == ".geojson":
        path.with_suffix(".json").write_text(text)
    print(f"wrote {path.relative_to(ROOT)} ({len(features)} features, {path.stat().st_size} bytes)")


def centroid(geom: dict) -> tuple[float, float] | None:
    def pts(g):
        t, c = g.get("type"), g.get("coordinates")
        if t == "Point":
            return [c]
        if t == "LineString":
            return c
        if t == "MultiLineString":
            out = []
            for ln in c:
                out.extend(ln)
            return out
        if t == "Polygon":
            return c[0]
        if t == "MultiPolygon":
            out = []
            for poly in c:
                out.extend(poly[0])
            return out
        return []

    p = pts(geom)
    if not p:
        return None
    return (sum(x[0] for x in p) / len(p), sum(x[1] for x in p) / len(p))


def min_rect(geom: dict) -> dict | None:
    def pts(g):
        t, c = g.get("type"), g.get("coordinates")
        if t == "Point":
            return [c]
        if t == "LineString":
            return c
        if t == "MultiLineString":
            out = []
            for ln in c:
                out.extend(ln)
            return out
        if t == "Polygon":
            return c[0]
        if t == "MultiPolygon":
            out = []
            for poly in c:
                out.extend(poly[0])
            return out
        return []

    p = pts(geom)
    if not p:
        return None
    lat0 = sum(x[1] for x in p) / len(p)
    mlat = 111320.0
    mlng = 111320.0 * math.cos(math.radians(lat0))
    xs = [(x[0] - p[0][0]) * mlng for x in p]
    ys = [(x[1] - p[0][1]) * mlat for x in p]
    best = (1e18, 0.0, 0.0)
    for deg in range(0, 180, 2):
        a = math.radians(deg)
        ca, sa = math.cos(a), math.sin(a)
        rx = [x * ca + y * sa for x, y in zip(xs, ys)]
        ry = [-x * sa + y * ca for x, y in zip(xs, ys)]
        w, h = max(rx) - min(rx), max(ry) - min(ry)
        area = w * h
        if area < best[0]:
            best = (area, w, h)
    long_m, short_m = sorted([best[1], best[2]], reverse=True)
    return {"long_m": round(long_m, 1), "short_m": round(short_m, 1)}


def dist_m(a, b) -> float:
    lat = (a[1] + b[1]) / 2
    dx = (a[0] - b[0]) * 111320 * math.cos(math.radians(lat))
    dy = (a[1] - b[1]) * 111320
    return math.hypot(dx, dy)


def in_lock_bbox(c) -> bool:
    if not c:
        return False
    return BBOX_LOCK["west"] <= c[0] <= BBOX_LOCK["east"] and BBOX_LOCK["south"] <= c[1] <= BBOX_LOCK["north"]


def feat(geometry, properties, source_key: str):
    props = dict(properties)
    props["_source"] = source_key
    props["_retrievedAt"] = RETRIEVED
    return {"type": "Feature", "properties": props, "geometry": geometry}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "checks").mkdir(exist_ok=True)

    # --- locks ---
    sluis = load("sluis_v.json")
    kolk = load("sluiskolk_v.json")
    lock_id = {
        "Westsluis Terneuzen": "westsluis",
        "Oostsluis Terneuzen": "oostsluis",
        "Nieuwe Sluis Terneuzen": "nieuwe-sluis",
    }
    lock_feats = []
    for f in sluis["features"]:
        p = f["properties"]
        lid = lock_id[p["name"]]
        c = centroid(f["geometry"])
        lock_feats.append(
            feat(
                f["geometry"],
                {
                    "id": lid,
                    "officialName": p["name"],
                    "kind": "lock",
                    "operational": True,
                    "condition": p.get("condition"),
                    "numberOfChambers": p.get("numberofchambers"),
                    "lengthM_attr": p.get("length"),
                    "widthM_attr": p.get("width"),
                    "rotation": p.get("rotation"),
                    "rwsId": p.get("id"),
                    "isrsId": p.get("isrsid"),
                    "vinCode": p.get("vincode"),
                    "address": p.get("address"),
                    "relatedComplex": p.get("relatedbuildingcomplexname"),
                    "centroid": {"lng": round(c[0], 6), "lat": round(c[1], 6)} if c else None,
                    "rwsCollection": "sluis_v",
                },
                "rws_fis",
            )
        )
    write_fc(OUT / "locks-rws.geojson", lock_feats, name="locks-rws", source=SOURCES["rws_fis"], extra={
        "verification": "Exactly three CONSTRUCTED locks. No Middensluis feature in sluis_v inside the Noordzeesluizen bbox."
    })

    kolk_id = {
        "Sluiskolk Westsluis Terneuzen": "westsluis",
        "Sluiskolk Oostsluis Terneuzen": "oostsluis",
        "Sluiskolk Nieuwe Sluis Terneuzen": "nieuwe-sluis",
    }
    kolk_feats = []
    for f in kolk["features"]:
        p = f["properties"]
        lid = kolk_id[p["name"]]
        c = centroid(f["geometry"])
        kolk_feats.append(
            feat(
                f["geometry"],
                {
                    "id": f"{lid}-chamber",
                    "lockId": lid,
                    "officialName": p["name"],
                    "kind": "lock-chamber",
                    "lengthM_attr": p.get("length"),
                    "widthM_attr": p.get("width"),
                    "gateWidthM": p.get("gatewidth"),
                    "schutlengteEbM": p.get("schutlengteeb"),
                    "schutlengteVloedM": p.get("schutlengtevloed"),
                    "sillDepthBuitenM": p.get("silldepthbebu"),
                    "sillDepthBinnenM": p.get("silldepthbobi"),
                    "note": p.get("note"),
                    "rwsId": p.get("id"),
                    "isrsId": p.get("isrsid"),
                    "vinCode": p.get("vincode"),
                    "centroid": {"lng": round(c[0], 6), "lat": round(c[1], 6)} if c else None,
                    "rwsCollection": "sluiskolk_v",
                },
                "rws_fis",
            )
        )
    write_fc(OUT / "lock-chambers-rws.geojson", kolk_feats, name="lock-chambers-rws", source=SOURCES["rws_fis"], extra={
        "scaleNote": "Official chamber sizes differ: West 290×38 m, Oost 280×24 m, Nieuwe Sluis kolk 417×55 m (sluis_v length/width 427×55). Scale differences are real."
    })

    # --- bridges RWS points ---
    brug = load("brug.json")
    bridge_meta = {
        "Brug over buitenhoofd Oostsluis Terneuzen": {
            "id": "oostsluis-buitenhoofd",
            "lockId": "oostsluis",
            "end": "buitenhoofd",
            "compass": "north",
            "ndwIsrs": "NLTNZ130B20497800009",
            "a2CorroborationId": "buitenhaven-noord",
        },
        "Brug over binnenhoofd Oostsluis Terneuzen": {
            "id": "oostsluis-binnenhoofd",
            "lockId": "oostsluis",
            "end": "binnenhoofd",
            "compass": "south",
            "ndwIsrs": "NLTNZ130B20497600005",
            "a2CorroborationId": "buitenhaven-oostsluis",
        },
        "Noordbrug over Westsluis Terneuzen": {
            "id": "westsluis-noord",
            "lockId": "westsluis",
            "end": "noord",
            "compass": "north",
            "ndwIsrs": None,
            "a2CorroborationId": "buitenhaven-westsluis",
        },
        "Zuidbrug Westsluis Terneuzen": {
            "id": "westsluis-zuid",
            "lockId": "westsluis",
            "end": "zuid",
            "compass": "south",
            "ndwIsrs": None,
            "a2CorroborationId": "buitenhaven-zuid",
        },
        "Brug over buitenhoofd Nieuwe Sluis Terneuzen": {
            "id": "nieuwe-sluis-buitenhoofd",
            "lockId": "nieuwe-sluis",
            "end": "buitenhoofd",
            "compass": "north",
            "ndwIsrs": None,
            "a2CorroborationId": "buitenhaven-midden",
            "a2Note": "A2 OSM span 'buitenhaven-midden' is near this bridge; not a third operational lock.",
        },
        "Brug over binnenhoofd Nieuwe Sluis Terneuzen": {
            "id": "nieuwe-sluis-binnenhoofd",
            "lockId": "nieuwe-sluis",
            "end": "binnenhoofd",
            "compass": "south",
            "ndwIsrs": None,
            "a2CorroborationId": None,
            "a2Note": "Missing from A2 OSM span set.",
        },
    }
    bridge_pts = []
    rws_by_id = {}
    for f in brug["features"]:
        p = f["properties"]
        meta = bridge_meta[p["name"]]
        rws_by_id[meta["id"]] = f
        coords = f["geometry"]["coordinates"]
        bridge_pts.append(
            feat(
                f["geometry"],
                {
                    **meta,
                    "officialName": p["name"],
                    "kind": "bridge",
                    "canOpen_rws": p.get("canopen"),
                    "condition": p.get("condition"),
                    "numberOfOpenings": p.get("numberofopenings"),
                    "rotation": p.get("rotation"),
                    "lengthM_attr": p.get("length"),
                    "widthM_attr": p.get("width"),
                    "rwsId": p.get("id"),
                    "isrsId": p.get("isrsid"),
                    "vinCode": p.get("vincode"),
                    "relatedComplex": p.get("relatedbuildingcomplexname"),
                    "coordinates": {"lng": coords[0], "lat": coords[1]},
                    "rwsCollection": "brug",
                    "geometryRole": "RWS point (no official length/width on this collection)",
                },
                "rws_fis",
            )
        )
    write_fc(OUT / "bridges-rws.geojson", bridge_pts, name="bridges-rws", source=SOURCES["rws_fis"], extra={
        "ndwMapping": {
            "NLTNZ130B20497800009": "oostsluis-buitenhoofd",
            "NLTNZ130B20497600005": "oostsluis-binnenhoofd",
        },
        "note": "RWS brug is point geometry. Deck polygons come from BGT overbruggingsdeel. canOpen_rws=No on Nieuwe Sluis brgare records; doorvaartopening ISRS still exist (see isrs-rws.geojson).",
    })

    # --- BGT decks matched to RWS points ---
    ob = load("bgt_overbruggingsdeel.json")
    deck_pick = {
        "oostsluis-buitenhoofd": "L0002.faa0349e93b14b19b9f894d63068bc08",
        "oostsluis-binnenhoofd": "L0002.a9bd762735a7436ea629d48a211499a6",
        "westsluis-noord": "L0002.2825d1e69b8844fabd9277786a4875d8",
        "westsluis-zuid": "L0002.3f10b8d308074cd2949bd066f1da1b92",
        "nieuwe-sluis-buitenhoofd": "L0002.84857330f6be4df8a27522747abb82b4",
        "nieuwe-sluis-binnenhoofd": "L0002.fb4c118d07fb47bc8c394fb37614c09c",
    }
    by_lokaal = {f["properties"].get("lokaal_id"): f for f in ob["features"]}
    deck_feats = []
    for bid, lok in deck_pick.items():
        f = by_lokaal[lok]
        p = f["properties"]
        meta = next(m for m in bridge_meta.values() if m["id"] == bid)
        sz = min_rect(f["geometry"])
        rws = rws_by_id[bid]
        d = dist_m(centroid(f["geometry"]), rws["geometry"]["coordinates"][:2])
        deck_feats.append(
            feat(
                f["geometry"],
                {
                    **meta,
                    "kind": "bridge-deck",
                    "bgtLokaalId": lok,
                    "bgtTypeOverbruggingsdeel": p.get("type_overbruggingsdeel"),
                    "bgtBeweegbaar": p.get("overbrugging_is_beweegbaar"),
                    "bgtStatus": p.get("status"),
                    "relatieveHoogteligging": p.get("relatieve_hoogteligging"),
                    "measuredMinRectM": sz,
                    "distanceToRwsPointM": round(d, 1),
                    "lvPublicatiedatum": p.get("lv_publicatiedatum"),
                    "bronhouder": p.get("bronhouder"),
                },
                "bgt",
            )
        )
    write_fc(OUT / "bridges-bgt-decks.geojson", deck_feats, name="bridges-bgt-decks", source=SOURCES["bgt"], extra={
        "selection": "One primary deck polygon per RWS bridge, nearest large BGT overbruggingsdeel at the lock heads. Landhoofden omitted.",
        "nieuweSluisSize": "BGT min-rotated rectangle ≈ 84.9 × 17.6–17.8 m, matching BAM 84 × 18 m design. RWS brug has no length/width.",
    })

    # --- ISRS ---
    isrs = load("isrs_object.json")
    isrs2 = load("isrs_object_p2.json") if (SRC / "isrs_object_p2.json").exists() else {"features": []}
    keep_fn = {
        "lokare",
        "lokbsn",
        "brgare",
        "bridge_5",
        "junction",
        "termnl",
    }
    isrs_feats = []
    for f in isrs["features"] + isrs2.get("features", []):
        p = f["properties"]
        fn = p.get("function")
        name = (p.get("objectname") or "") + " " + (p.get("code") or "")
        interesting = fn in keep_fn or any(
            s in name.lower()
            for s in ["sluis", "brug", "midden", "204976", "204978"]
        )
        if not interesting:
            continue
        c = f["geometry"]["coordinates"][:2] if f.get("geometry") else None
        if c and not in_lock_bbox(c) and "midden" not in name.lower() and "20497" not in name:
            # keep leftover Middensluis toponyms even if slightly outside
            if not any(s in name.lower() for s in ["westsluis", "oostsluis", "nieuwe sluis", "204976", "204978"]):
                continue
        isrs_feats.append(
            feat(
                f["geometry"],
                {
                    "code": p.get("code"),
                    "objectName": p.get("objectname"),
                    "function": fn,
                    "rwsId": p.get("id"),
                    "kind": "isrs",
                    "operationalLock": p.get("objectname") in (
                        "Westsluis Terneuzen",
                        "Oostsluis Terneuzen",
                        "Nieuwe Sluis Terneuzen",
                    ),
                    "leftoverMiddensluisToponym": "midden" in (p.get("objectname") or "").lower(),
                    "knownNdwLive": p.get("code") in (
                        "NLTNZ130B20497600005",
                        "NLTNZ130B20497800009",
                    ),
                },
                "rws_fis",
            )
        )
    write_fc(OUT / "isrs-rws.geojson", isrs_feats, name="isrs-rws", source=SOURCES["rws_fis"], extra={
        "knownNdwLiveIsrs": ["NLTNZ130B20497600005", "NLTNZ130B20497800009"],
        "note": "NDW fetch codes are unchanged. Unseen ISRS must never paint open. Leftover 'Middensluis' names are toponyms/junctions, not an operational lock.",
    })

    # --- NWB roads + roundabouts ---
    nwb = load("nwb_wegvakken.json")
    nwb_keep_streets = {
        "Buitenhaven",
        "Kennedylaan",
        "Binnenvaartweg",
        "Schependijk",
        "Westkolkstraat",
    }
    road_feats = []
    nrb_feats = []
    for f in nwb["features"]:
        p = f["properties"]
        c = centroid(f["geometry"])
        if not in_lock_bbox(c):
            continue
        stt = p.get("stt_naam")
        fow = str(p.get("fow"))
        bst = p.get("bst_code")
        slim = {
            "sttNaam": stt,
            "wvkId": p.get("wvk_id"),
            "objectId": p.get("objectid"),
            "fow": p.get("fow"),
            "fowMeaning": {"2": "multiple_carriageway", "3": "single_carriageway", "4": "roundabout", "7": "other"}.get(fow),
            "bstCode": bst,
            "frc": p.get("frc"),
            "rijrichtng": p.get("rijrichtng"),
            "bronjaar": p.get("bronjaar"),
            "geoBron": p.get("geobron_nm"),
            "kind": "road",
        }
        if fow == "4" and bst == "NRB":
            # two clusters
            c1 = (3.81930, 51.33285)
            c2 = (3.82190, 51.33332)
            c3 = (3.82125, 51.33605)
            d1, d2, d3 = dist_m(c, c1), dist_m(c, c2), dist_m(c, c3)
            if d1 <= 80:
                rid, rname = "roundabout-nieuwe-oost", "Rotonde Buitenhaven tussen Nieuwe Sluis en Oostsluis"
            elif d2 <= 90:
                rid, rname = "roundabout-kennedylaan", "Rotonde Buitenhaven / Kennedylaan / Schependijk / Binnenvaartweg"
            elif d3 <= 80:
                rid, rname = "roundabout-binnenvaartweg-noord", "Rotonde Binnenvaartweg noord (oost van Oostsluis-buitenhoofd)"
            else:
                rid, rname = "roundabout-other", stt
            nrb_feats.append(
                feat(
                    f["geometry"],
                    {**slim, "id": rid, "officialName": rname, "kind": "roundabout-carriageway"},
                    "nwb",
                )
            )
        if stt in nwb_keep_streets and bst in ("RB", "NRB", "HR"):
            road_feats.append(feat(f["geometry"], slim, "nwb"))
    write_fc(OUT / "roads-nwb-lock-island.geojson", road_feats, name="roads-nwb-lock-island", source=SOURCES["nwb"], extra={
        "filter": "Lock-island bbox; streets Buitenhaven, Kennedylaan, Binnenvaartweg, Schependijk, Westkolkstraat; BST in RB/NRB/HR (rijbanen).",
    })
    write_fc(OUT / "roundabouts-nwb.geojson", nrb_feats, name="roundabouts-nwb", source=SOURCES["nwb"], extra={
        "clusters": [
            {
                "id": "roundabout-nieuwe-oost",
                "between": ["nieuwe-sluis", "oostsluis"],
                "approx": {"lng": 3.8193, "lat": 51.33285},
            },
            {
                "id": "roundabout-kennedylaan",
                "role": "road connection east toward Kennedylaan / Binnenvaartweg / Schependijk",
                "approx": {"lng": 3.8219, "lat": 51.3333},
            },
            {
                "id": "roundabout-binnenvaartweg-noord",
                "role": "road connection north-east of Oostsluis buitenhoofd along Binnenvaartweg",
                "approx": {"lng": 3.82125, "lat": 51.33605},
            },
        ]
    })

    # BGT ring polygon for eastern roundabout (optional supporting surface, still official)
    wd = load("bgt_wegdeel.json")
    ring_id = None
    ring_feats = []
    best = None
    for f in wd["features"]:
        p = f["properties"]
        if p.get("eind_registratie") or p.get("status") != "bestaand":
            continue
        if p.get("functie") != "rijbaan lokale weg":
            continue
        c = centroid(f["geometry"])
        if not c:
            continue
        if dist_m(c, (3.82195, 51.33334)) < 15:
            sz = min_rect(f["geometry"])
            npts = len((f["geometry"].get("coordinates") or [[]])[0]) if f["geometry"].get("type") == "Polygon" else 0
            if sz and sz["long_m"] > 30 and sz["short_m"] > 30 and (best is None or npts > best):
                best = npts
                ring_feats = [
                    feat(
                        f["geometry"],
                        {
                            "id": "roundabout-kennedylaan-surface",
                            "kind": "roundabout-surface",
                            "matchesNwbCluster": "roundabout-kennedylaan",
                            "bgtFunctie": p.get("functie"),
                            "bgtLokaalId": p.get("lokaal_id"),
                            "measuredMinRectM": sz,
                            "bgtStatus": p.get("status"),
                        },
                        "bgt",
                    )
                ]
    write_fc(OUT / "roundabout-kennedylaan-bgt.geojson", ring_feats, name="roundabout-kennedylaan-bgt", source=SOURCES["bgt"], extra={
        "note": "BGT rijbaan lokale weg ring (~42×42 m) coinciding with NWB NRB cluster at Kennedylaan. The Nieuwe–Oost roundabout is recorded as NWB NRB centerlines; no equally clear BGT ring was selected there (not invented).",
    })

    # --- water ---
    water = load("bgt_waterdeel.json")
    water_feats = []
    for f in water["features"]:
        p = f["properties"]
        if p.get("eind_registratie") or p.get("status") != "bestaand":
            continue
        c = centroid(f["geometry"])
        if not in_lock_bbox(c):
            continue
        water_feats.append(
            feat(
                f["geometry"],
                {
                    "kind": "water",
                    "bgtType": p.get("type"),
                    "bgtPlusType": p.get("plus_type"),
                    "bgtLokaalId": p.get("lokaal_id"),
                    "bgtStatus": p.get("status"),
                    "bronhouder": p.get("bronhouder"),
                    "lvPublicatiedatum": p.get("lv_publicatiedatum"),
                },
                "bgt",
            )
        )
    write_fc(OUT / "water-bgt.geojson", water_feats, name="water-bgt", source=SOURCES["bgt"], extra={
        "filter": "status=bestaand waterdeel intersecting lock-island bbox. Geometry as published; not reconstructed.",
    })

    # --- BGT sluis kunstwerk parts (gates/heads, not full chambers) ---
    kw = load("bgt_kunstwerkdeel_vlak.json")
    kw_feats = []
    for f in kw["features"]:
        p = f["properties"]
        if p.get("type") != "sluis" or p.get("eind_registratie") or p.get("status") != "bestaand":
            continue
        c = centroid(f["geometry"])
        sz = min_rect(f["geometry"])
        kw_feats.append(
            feat(
                f["geometry"],
                {
                    "kind": "lock-structure-part",
                    "bgtType": "sluis",
                    "bgtLokaalId": p.get("lokaal_id"),
                    "measuredMinRectM": sz,
                    "centroid": {"lng": round(c[0], 6), "lat": round(c[1], 6)} if c else None,
                    "note": "BGT lock parts (heads/gates). Full chamber footprints are RWS sluiskolk_v, not these fragments.",
                },
                "bgt",
            )
        )
    write_fc(OUT / "lock-structure-parts-bgt.geojson", kw_feats, name="lock-structure-parts-bgt", source=SOURCES["bgt"])

    # --- corroboration A2 OSM (NOT truth) ---
    a2 = [
        {
            "id": "buitenhaven-noord",
            "isrs": "NLTNZ130B20497800009",
            "osmWay": 7614741,
            "coords": [[3.8195971, 51.3360219], [3.8199592, 51.3360568]],
        },
        {
            "id": "buitenhaven-oostsluis",
            "isrs": "NLTNZ130B20497600005",
            "osmWay": 7614718,
            "coords": [[3.820291, 51.3330268], [3.8206566, 51.3330576]],
        },
        {
            "id": "buitenhaven-midden",
            "isrs": "",
            "osmWay": 1184744248,
            "coords": [[3.8183694, 51.3319095], [3.8171467, 51.3316072]],
        },
        {
            "id": "buitenhaven-westsluis",
            "isrs": "",
            "osmWay": 7614690,
            "coords": [[3.8157592, 51.3296126], [3.8163039, 51.3297833]],
        },
        {
            "id": "buitenhaven-zuid",
            "isrs": "",
            "osmWay": 7614035,
            "coords": [[3.8180858, 51.3266823], [3.8186301, 51.3268541]],
        },
    ]
    a2_feats = []
    for span in a2:
        a2_feats.append(
            {
                "type": "Feature",
                "properties": {
                    "id": span["id"],
                    "kind": "a2-osm-span-corroboration",
                    "osmWay": span["osmWay"],
                    "isrs": span["isrs"],
                    "groundTruth": False,
                    "_source": "brugapp-a2-lock-map",
                    "_note": "OSM/A2 is corroboration only — not geographic truth.",
                },
                "geometry": {"type": "LineString", "coordinates": span["coords"]},
            }
        )
    Path(OUT / "corroboration-a2-osm-spans.geojson").write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "name": "corroboration-a2-osm-spans",
                "groundTruth": False,
                "source": {
                    "name": "Live Brugapp A2 BUITENHAVEN_SPANS (OSM ways)",
                    "path": "src/lib/lock-map.ts",
                    "retrievedAt": TODAY,
                    "note": "Not truth. Kept so Phase 3+ can see where A2 diverges from official geometry.",
                },
                "features": a2_feats,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )
    print("wrote corroboration-a2-osm-spans.geojson")

    # --- index ---
    index = {
        "phase": 2,
        "title": "Terneuzen Noordzeesluizen geographic ground truth",
        "retrievedAt": RETRIEVED,
        "crs": "CRS84 / WGS84",
        "bbox": BBOX_LOCK,
        "operationalLocks": ["westsluis", "nieuwe-sluis", "oostsluis"],
        "notOperational": ["middensluis"],
        "ndwIsrs": {
            "NLTNZ130B20497600005": {
                "bridgeId": "oostsluis-binnenhoofd",
                "officialName": "Brug over binnenhoofd Oostsluis Terneuzen",
                "compass": "south",
            },
            "NLTNZ130B20497800009": {
                "bridgeId": "oostsluis-buitenhoofd",
                "officialName": "Brug over buitenhoofd Oostsluis Terneuzen",
                "compass": "north",
            },
        },
        "neverPaintUnseenOpen": True,
        "files": {
            "locks": "locks-rws.geojson",
            "chambers": "lock-chambers-rws.geojson",
            "bridges": "bridges-rws.geojson",
            "bridgeDecks": "bridges-bgt-decks.geojson",
            "roundabouts": "roundabouts-nwb.geojson",
            "roundaboutSurface": "roundabout-kennedylaan-bgt.geojson",
            "roads": "roads-nwb-lock-island.geojson",
            "water": "water-bgt.geojson",
            "isrs": "isrs-rws.geojson",
            "lockParts": "lock-structure-parts-bgt.geojson",
            "corroborationA2": "corroboration-a2-osm-spans.geojson",
        },
        "sources": SOURCES,
        "doNotUseForUiYet": True,
    }
    (OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n")
    print("wrote index.json")

    # luchtfoto
    src_img = SRC / "checks" / "luchtfoto.jpg"
    if src_img.exists():
        dest = OUT / "checks" / "luchtfoto-orthoHR.jpg"
        dest.write_bytes(src_img.read_bytes())
        (OUT / "checks" / "README.md").write_text(
            "# Imagery check only\n\n"
            "`luchtfoto-orthoHR.jpg` is a PDOK Actueel_orthoHR WMS snapshot retrieved "
            f"{TODAY} for visual confirmation. It is **not** a geometry source.\n"
        )
        print("wrote checks/luchtfoto-orthoHR.jpg")


if __name__ == "__main__":
    main()
