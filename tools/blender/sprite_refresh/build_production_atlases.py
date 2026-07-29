"""Build runtime atlases, labeled approval boards, and GIF previews from v003 RGBA sources."""

from __future__ import annotations

import json
import hashlib
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from production_config import (
    ACTIVE_FURNITURE,
    APPROVED_V002_CUSTOMERS,
    CHARACTER_FRAME_SIZE,
    DIRECTIONS,
    FURNITURE_DIRECTIONS,
    NEW_CUSTOMERS,
    PRODUCTION_OUTPUT_ROOT,
    STAFF_PROFESSIONS,
    animation_manifest_for_staff,
    furniture_anchor_for_footprint,
    furniture_asset_id,
    iter_furniture_render_assets,
    runtime_customer_id,
    runtime_staff_id,
    CUSTOMER_ANIMATIONS,
)


BG = (237, 228, 202, 255)
INK = (29, 55, 48, 255)
ACCENT = (166, 91, 34, 255)
GRID = (70, 108, 94, 120)


def font(size=22, bold=False):
    candidates = [
        Path("C:/Windows/Fonts") / ("segoeuib.ttf" if bold else "segoeui.ttf"),
        Path("C:/Windows/Fonts") / ("arialbd.ttf" if bold else "arial.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


def open_rgba(path):
    return Image.open(path).convert("RGBA")


def save_png(image, path):
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)


def character_source(asset_id, animation, direction, frame):
    return PRODUCTION_OUTPUT_ROOT / "sprites" / "characters" / asset_id / animation / direction / f"{frame:03d}.png"


def furniture_source(asset_id, state, direction):
    return PRODUCTION_OUTPUT_ROOT / "sprites" / "furniture" / asset_id / state / f"{direction}.png"


def file_record(path, **metadata):
    return {
        **metadata,
        "path": str(path.relative_to(PRODUCTION_OUTPUT_ROOT)).replace("\\", "/"),
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    }


def build_individual_manifest():
    files = []
    for spec in (*APPROVED_V002_CUSTOMERS, *NEW_CUSTOMERS):
        asset_id = runtime_customer_id(spec)
        for animation, count in CUSTOMER_ANIMATIONS.items():
            for direction in DIRECTIONS:
                for frame in range(count):
                    path = character_source(asset_id, animation, direction, frame)
                    files.append(file_record(path, assetId=asset_id, kind="character", animation=animation, direction=direction, frame=frame))
    for spec in STAFF_PROFESSIONS:
        asset_id = runtime_staff_id(spec)
        for animation, count in animation_manifest_for_staff(spec).items():
            for direction in DIRECTIONS:
                for frame in range(count):
                    path = character_source(asset_id, animation, direction, frame)
                    files.append(file_record(path, assetId=asset_id, kind="character", animation=animation, direction=direction, frame=frame))
    for definition, level, connection, layer, asset_id in iter_furniture_render_assets():
        for state in definition["states"]:
            for direction in FURNITURE_DIRECTIONS:
                path = furniture_source(asset_id, state, direction)
                files.append(file_record(path, assetId=asset_id, furnitureId=definition["furnitureId"], kind="furniture", level=level, connection=connection, layer=layer, state=state, direction=direction))
    manifest = {"version": "v003", "count": len(files), "files": files}
    (PRODUCTION_OUTPUT_ROOT / "individual_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def build_character_atlas(asset_id, animations):
    fw, fh = CHARACTER_FRAME_SIZE
    count = sum(animations.values())
    atlas = Image.new("RGBA", (fw * count, fh * len(DIRECTIONS)), (0, 0, 0, 0))
    for row, direction in enumerate(DIRECTIONS):
        column = 0
        for animation, frames in animations.items():
            for frame_index in range(frames):
                atlas.alpha_composite(open_rgba(character_source(asset_id, animation, direction, frame_index)), (column * fw, row * fh))
                column += 1
    output = PRODUCTION_OUTPUT_ROOT / "atlases" / "characters" / f"{asset_id}.png"
    save_png(atlas, output)
    make_thumbnail(open_rgba(character_source(asset_id, "idle", "sw", 0)), asset_id)
    return output


def build_furniture_atlas(definition, asset_id):
    fw = fh = 192
    states = definition["states"]
    atlas = Image.new("RGBA", (fw * len(states), fh * len(FURNITURE_DIRECTIONS)), (0, 0, 0, 0))
    for row, direction in enumerate(FURNITURE_DIRECTIONS):
        for column, state in enumerate(states):
            atlas.alpha_composite(open_rgba(furniture_source(asset_id, state, direction)), (column * fw, row * fh))
    output = PRODUCTION_OUTPUT_ROOT / "atlases" / "furniture" / f"{asset_id}.png"
    save_png(atlas, output)
    make_thumbnail(open_rgba(furniture_source(asset_id, states[0], "sw")), asset_id)
    return output


def make_thumbnail(source, asset_id):
    box = source.getbbox()
    crop = source.crop(box) if box else source
    crop.thumbnail((112, 112), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    canvas.alpha_composite(crop, ((128 - crop.width) // 2, 120 - crop.height))
    save_png(canvas, PRODUCTION_OUTPUT_ROOT / "atlases" / "thumbnails" / f"{asset_id}.png")


def labeled_grid(entries, output, columns, scale=1, title="", cell=(560, 760), show_measure=False):
    rows = math.ceil(len(entries) / columns)
    header = 90 if title else 25
    width = columns * cell[0] + 40
    height = rows * cell[1] + header + 30
    board = Image.new("RGBA", (width, height), BG)
    draw = ImageDraw.Draw(board)
    if title:
        draw.text((24, 20), title, fill=INK, font=font(34, True))
    for index, (label, path) in enumerate(entries):
        col, row = index % columns, index // columns
        x = 20 + col * cell[0]; y = header + row * cell[1]
        draw.rounded_rectangle((x+5,y+5,x+cell[0]-10,y+cell[1]-10), 18, fill=(249,244,226,255), outline=(179,157,113,255), width=3)
        image = open_rgba(path)
        if scale != 1:
            image = image.resize((image.width*scale,image.height*scale), Image.Resampling.NEAREST)
        box = image.getbbox(); image = image.crop(box) if box else image
        max_w, max_h = cell[0]-40, cell[1]-92
        if image.width > max_w or image.height > max_h:
            factor = min(max_w/image.width, max_h/image.height)
            image = image.resize((max(1,int(image.width*factor)),max(1,int(image.height*factor))),Image.Resampling.NEAREST)
        board.alpha_composite(image, (x+(cell[0]-image.width)//2, y+48+(max_h-image.height)//2))
        draw.text((x+18,y+14), label, fill=INK, font=font(20, True))
        if show_measure:
            center_x = x + cell[0] // 2
            floor_y = y + cell[1] - 50
            diamond = [(center_x, floor_y-24), (center_x+48, floor_y), (center_x, floor_y+24), (center_x-48, floor_y), (center_x, floor_y-24)]
            draw.line(diamond, fill=GRID, width=2)
            draw.line((center_x-62, floor_y+30, center_x+62, floor_y+30), fill=ACCENT, width=2)
            draw.line((center_x-62, floor_y+25, center_x-62, floor_y+35), fill=ACCENT, width=2)
            draw.line((center_x+62, floor_y+25, center_x+62, floor_y+35), fill=ACCENT, width=2)
            draw.text((center_x-57, floor_y+34), "1,000 BU · pivô (0,0,0)", fill=INK, font=font(14, True))
    save_png(board, output)


def build_customer_boards():
    entries = [(spec["id"], character_source(runtime_customer_id(spec), "idle", "sw", 0)) for spec in NEW_CUSTOMERS]
    labeled_grid(entries, PRODUCTION_OUTPUT_ROOT / "approval_customers_30.png", 5, scale=4, title="30 NOVOS CLIENTES · PRODUÇÃO V003", cell=(500,720))
    labeled_grid(entries, PRODUCTION_OUTPUT_ROOT / "approval_customers_30_actual_size.png", 5, scale=1, title="30 CLIENTES · TAMANHO REAL 112×168", cell=(210,260))


def build_staff_boards():
    entries = [(f"{spec['label']} · {spec['professionId']}", character_source(runtime_staff_id(spec), "idle", "sw", 0)) for spec in STAFF_PROFESSIONS]
    labeled_grid(entries, PRODUCTION_OUTPUT_ROOT / "approval_staff_professions.png", 4, scale=3, title="FUNCIONÁRIOS POR PROFISSÃO", cell=(460,650))
    turnaround = []
    for spec in STAFF_PROFESSIONS:
        for direction in DIRECTIONS:
            turnaround.append((f"{spec['professionId']} · {direction.upper()}", character_source(runtime_staff_id(spec), "idle", direction, 0)))
    labeled_grid(turnaround, PRODUCTION_OUTPUT_ROOT / "approval_staff_turnarounds.png", 4, scale=2, title="TURNAROUNDS DAS PROFISSÕES", cell=(310,430))


def build_furniture_boards():
    entries = []
    for definition in ACTIVE_FURNITURE:
        for level in range(1,6):
            connection = "isolated" if definition.get("connectionVariants") else None
            layer = "full" if definition.get("layers") else None
            asset_id = furniture_asset_id(definition, level, connection, layer)
            entries.append((f"{definition['slug']} · L{level}", furniture_source(asset_id, definition["states"][0], "sw")))
    labeled_grid(entries, PRODUCTION_OUTPUT_ROOT / "approval_furniture_levels_overview.png", 5, scale=2, title="MÓVEIS · NÍVEIS 1 A 5", cell=(440,500), show_measure=True)
    for page in range(3):
        page_entries = entries[page * 25:(page + 1) * 25]
        labeled_grid(page_entries, PRODUCTION_OUTPUT_ROOT / f"approval_furniture_levels_page_{page + 1}.png", 5, scale=2, title=f"MÓVEIS · NÍVEIS 1 A 5 · PÁGINA {page + 1}/3", cell=(440,500), show_measure=True)
    active = []
    for definition in ACTIVE_FURNITURE:
        if len(definition["states"]) == 1:
            continue
        for level in range(1,6):
            asset_id = furniture_asset_id(definition, level)
            for state in definition["states"]:
                active.append((f"{definition['slug']} L{level} · {state}", furniture_source(asset_id, state, "sw")))
    labeled_grid(active, PRODUCTION_OUTPUT_ROOT / "approval_furniture_active_states_all_levels.png", 8, scale=1, title="ESTADOS ATIVOS E INATIVOS · TODOS OS NÍVEIS", cell=(270,300))
    alignment = []
    for level in range(1,6):
        for slug in ("c1_service","a1_stove","a8_coffee","b5_sink","a4_fryer"):
            definition = next(item for item in ACTIVE_FURNITURE if item["slug"] == slug)
            asset_id = furniture_asset_id(definition, level, "isolated" if definition.get("connectionVariants") else None)
            alignment.append((f"L{level} · {slug}", furniture_source(asset_id, definition["states"][0], "sw")))
    labeled_grid(alignment, PRODUCTION_OUTPUT_ROOT / "approval_counter_levels_alignment.png", 5, scale=2, title="BASES DE BALCÃO · ALINHAMENTO 1,000 BU · TOLERÂNCIA 0,001 BU", cell=(430,500), show_measure=True)


def build_furniture_tile_alignment_board():
    scale = 2
    board = Image.new("RGBA", (1500, 1840), BG)
    draw = ImageDraw.Draw(board)
    draw.text((28, 20), "CORREÇÃO DE FOOTPRINT · CONTATO EXATO COM OS TILES", fill=INK, font=font(34, True))
    draw.text((28, 66), "Comparação equivalente: 2 módulos 1×1 · 1 bancada 2×1", fill=INK, font=font(22))

    def tile(center_x, center_y):
        points = [(center_x, center_y-32), (center_x+64, center_y), (center_x, center_y+32), (center_x-64, center_y), (center_x, center_y-32)]
        draw.line(points, fill=GRID, width=3)

    def place(path, point_x, point_y, anchor):
        image = open_rgba(path).resize((192*scale, 192*scale), Image.Resampling.NEAREST)
        board.alpha_composite(image, (round(point_x-anchor[0]*192*scale), round(point_y-anchor[1]*192*scale)))

    service = next(item for item in ACTIVE_FURNITURE if item["slug"] == "c1_service")
    pastry = next(item for item in ACTIVE_FURNITURE if item["slug"] == "b8_pastry")
    for level in range(1, 6):
        top = 120 + (level-1)*340
        draw.rounded_rectangle((20, top, 1480, top+318), 18, fill=(249,244,226,255), outline=(179,157,113,255), width=3)
        draw.text((40, top+18), f"L{level}", fill=INK, font=font(25, True))

        pair_x, pair_y = 330, top+145
        tile(pair_x-32, pair_y-16)
        tile(pair_x+32, pair_y+16)
        for point_x, point_y, connection in (
            (pair_x-32, pair_y+16, "left"),
            (pair_x+32, pair_y+48, "right"),
        ):
            asset_id = furniture_asset_id(service, level, connection)
            place(furniture_source(asset_id, "idle", "sw"), point_x, point_y, furniture_anchor_for_footprint((1, 1)))
        pair_anchor_y = pair_y + 48
        draw.line((80, pair_anchor_y, 640, pair_anchor_y), fill=ACCENT, width=2)
        draw.ellipse((pair_x-4, pair_anchor_y-4, pair_x+4, pair_anchor_y+4), fill=ACCENT)
        draw.multiline_text((500, top+78), "2 módulos 1×1\nmesmo footprint total 2×1\nprojeção da base: ≤ 1 px", fill=INK, font=font(17, True), spacing=6)

        base_x, base_y = 1040, top+145
        tile(base_x-32, base_y-16)
        tile(base_x+32, base_y+16)
        asset_id = furniture_asset_id(pastry, level)
        point_x = base_x
        point_y = base_y + 48
        place(furniture_source(asset_id, "off", "sw"), point_x, point_y, furniture_anchor_for_footprint((2, 1)))
        draw.line((800, point_y, 1160, point_y), fill=ACCENT, width=2)
        draw.ellipse((point_x-4, point_y-4, point_x+4, point_y+4), fill=ACCENT)
        draw.multiline_text((1190, top+78), "1 bancada 2×1\nmesma linha de contato\nâncora Y = 182 px", fill=INK, font=font(17, True), spacing=6)
    save_png(board, PRODUCTION_OUTPUT_ROOT / "approval_furniture_tile_alignment.png")


def gif_grid(paths, output, columns, duration=125, scale=3):
    frame_count = max(len(sequence) for _, sequence in paths)
    rows = math.ceil(len(paths)/columns)
    frames = []
    for index in range(frame_count):
        canvas = Image.new("RGBA", (columns*112*scale, rows*168*scale), BG)
        for item_index, (_, sequence) in enumerate(paths):
            image = open_rgba(sequence[index % len(sequence)]).resize((112*scale,168*scale), Image.Resampling.NEAREST)
            canvas.alpha_composite(image, ((item_index%columns)*112*scale,(item_index//columns)*168*scale))
        frames.append(canvas.convert("P", palette=Image.Palette.ADAPTIVE))
    output.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(output, save_all=True, append_images=frames[1:], loop=0, duration=duration, disposal=2)


def build_gifs():
    customer_sequences = []
    for spec in NEW_CUSTOMERS[:6]:
        asset_id = runtime_customer_id(spec)
        customer_sequences.append((asset_id, [character_source(asset_id,"walk","sw",frame) for frame in range(8)]))
    gif_grid(customer_sequences, PRODUCTION_OUTPUT_ROOT/"previews"/"customers_walking.gif", 3)
    operating = []
    for spec in STAFF_PROFESSIONS[:6]:
        asset_id = runtime_staff_id(spec)
        animation = "clean_table" if spec["animationRole"] == "cleaner" else "cook_stove" if spec["animationRole"] == "cook" else "serve_table"
        operating.append((asset_id,[character_source(asset_id,animation,"sw",frame) for frame in range(animation_manifest_for_staff(spec)[animation])]))
    gif_grid(operating, PRODUCTION_OUTPUT_ROOT/"previews"/"staff_operating.gif", 3)
    waiter = next(spec for spec in STAFF_PROFESSIONS if spec["professionId"] == "service")
    waiter_id = runtime_staff_id(waiter)
    gif_grid([(waiter_id,[character_source(waiter_id,"carry_tray_walk","sw",frame) for frame in range(8)])], PRODUCTION_OUTPUT_ROOT/"previews"/"waiter_tray.gif", 1)
    examples = []
    for slug in ("a1_stove","a8_coffee","b5_sink","dining_table"):
        definition = next(item for item in ACTIVE_FURNITURE if item["slug"] == slug)
        sequence = []
        for level in range(1,6):
            asset_id = furniture_asset_id(definition, level)
            sequence.append(furniture_source(asset_id, definition["states"][0], "sw"))
        examples.append((slug,sequence))
    furniture_frames=[]
    for frame_index in range(5):
        canvas=Image.new("RGBA",(4*192*2,192*2),BG)
        for col,(_,sequence) in enumerate(examples):
            image=open_rgba(sequence[frame_index]).resize((384,384),Image.Resampling.NEAREST)
            canvas.alpha_composite(image,(col*384,0))
        furniture_frames.append(canvas.convert("P",palette=Image.Palette.ADAPTIVE))
    output=PRODUCTION_OUTPUT_ROOT/"previews"/"furniture_levels_1_to_5.gif";output.parent.mkdir(parents=True,exist_ok=True)
    furniture_frames[0].save(output,save_all=True,append_images=furniture_frames[1:],loop=0,duration=650,disposal=2)


def main():
    individual_manifest = build_individual_manifest()
    atlases=[]
    for spec in (*APPROVED_V002_CUSTOMERS,*NEW_CUSTOMERS):
        asset_id=runtime_customer_id(spec);atlases.append(build_character_atlas(asset_id,CUSTOMER_ANIMATIONS))
    for spec in STAFF_PROFESSIONS:
        asset_id=runtime_staff_id(spec);atlases.append(build_character_atlas(asset_id,animation_manifest_for_staff(spec)))
    for definition,level,connection,layer,asset_id in iter_furniture_render_assets():
        atlases.append(build_furniture_atlas(definition,asset_id))
    build_customer_boards();build_staff_boards();build_furniture_boards();build_furniture_tile_alignment_board();build_gifs()
    manifest={"atlases":[str(path.relative_to(PRODUCTION_OUTPUT_ROOT)).replace("\\","/") for path in atlases],"count":len(atlases)}
    (PRODUCTION_OUTPUT_ROOT/"atlas_manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"INDIVIDUALS={individual_manifest['count']}")
    print(f"ATLASES={len(atlases)}")


if __name__ == "__main__":
    main()
