from __future__ import annotations

import os
from array import array
from math import radians, sin, cos, tau
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
BLEND_PATH = Path(os.environ['BLENDER_CODEX_BLEND_PATH'])
PREVIEW_PATH = Path(os.environ['BLENDER_CODEX_PREVIEW_PATH'])
OUT = ROOT / 'public/assets/pixel/rendered/food/v008'
THUMBS = OUT / 'thumbnails'
FRAME = 96
DIRECTIONS = (('ne', 180), ('nw', 270), ('se', 90), ('sw', 0))

RECIPES = [
('coffee','coffee'),('chocolate-cookies','cookies'),('soup','soup'),('omelette','omelette'),('french-fries','fries'),('cheese-bread','bites'),('hot-dog','hotdog'),('cheese-tapioca','folded'),('misto-quente','sandwich'),('burger','burger'),('honey-pancakes','pancakes'),('coxinha','bites'),('caesar-salad','salad'),
('tomato-spaghetti','pasta'),('cappuccino','coffee'),('mozzarella-pizza','pizza'),('grilled-chicken-rice','main'),('caldo-verde','soup'),('donuts','donuts'),('cheeseburger','burger'),('croissant','pastry'),('meat-pastel','folded'),('bolognese-lasagna','lasagna'),('mushroom-risotto','risotto'),('fish-moqueca','stew'),('hot-chocolate','coffee'),
('fish-and-chips','main'),('feijoada','stew'),('roast-chicken-vegetables','roast'),('mexican-tacos','tacos'),('strawberry-milkshake','milkshake'),('chicken-stroganoff','stew'),('ramen','ramen'),('barbecue-ribs','ribs'),('bacon-cheese-quiche','quiche'),('acai-bowl','acai'),('paella','paella'),('brownie-ice-cream','dessert'),('onion-steak-fries','steak'),
('gratin-onion-soup','soup'),('sushi-combo','sushi'),('grilled-salmon-asparagus','salmon'),('picanha','steak'),('petit-gateau','dessert'),('latte-art','coffee'),('roast-lamb-potatoes','roast'),('butter-lobster','lobster'),('filet-mignon-madeira','steak'),('shrimp-risotto','risotto'),('berry-cheesecake','cake'),('premium-seafood-board','seafood'),('truffle-medallion-puree','steak')]

def mat(name, color, rough=.72):
    result=bpy.data.materials.new(name); result.diffuse_color=(*color,1); result.use_nodes=True
    shader=result.node_tree.nodes.get('Principled BSDF'); shader.inputs['Base Color'].default_value=(*color,1); shader.inputs['Roughness'].default_value=rough
    return result

M={
'ceramic':mat('Warm ivory ceramic',(.88,.78,.60)),'ivory':mat('Ceramic highlight',(1.0,.92,.74)),'brown':mat('Grilled brown',(.30,.09,.025)),'dark':mat('Dark roast',(.10,.025,.008)),'bun':mat('Golden bread',(.88,.40,.07)),'gold':mat('Golden crust',(1.0,.60,.08)),'yellow':mat('Cheese and egg',(1.0,.72,.06)),'red':mat('Tomato red',(.88,.05,.02)),'orange':mat('Carrot orange',(1.0,.28,.02)),'green':mat('Fresh green',(.05,.42,.09)),'cream':mat('Cream',(.98,.84,.54)),'white':mat('Rice and cream',(.96,.94,.82)),'pink':mat('Berry pink',(.92,.22,.28)),'purple':mat('Acai berry',(.24,.025,.30)),'fish':mat('Salmon coral',(1.0,.25,.08)),'sea':mat('Seafood shell',(.88,.12,.025)),'broth':mat('Tomato broth',(.78,.12,.015),.5),'chocolate':mat('Chocolate',(.18,.035,.012)),'nori':mat('Nori',(.015,.10,.055))}

def move(obj,col):
    for owner in list(obj.users_collection): owner.objects.unlink(obj)
    col.objects.link(obj); return obj

def cylinder(name,radius,depth,z,material,col,vertices=14,scale=(1,1,1),xy=(0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=(xy[0],xy[1],z)); obj=move(bpy.context.object,col); obj.name=name; obj.scale=scale; obj.data.materials.append(material)
    bevel=obj.modifiers.new('Low-poly bevel','BEVEL'); bevel.width=.018; bevel.segments=1; return obj

def cube(name,loc,dims,material,col,rot=0,bevel=.018):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc,rotation=(0,0,rot)); obj=move(bpy.context.object,col); obj.name=name; obj.dimensions=dims; bpy.context.view_layer.objects.active=obj; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); obj.data.materials.append(material)
    if bevel: mod=obj.modifiers.new('Low-poly bevel','BEVEL'); mod.width=bevel; mod.segments=1
    return obj

def sphere(name,loc,scale,material,col):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=loc); obj=move(bpy.context.object,col); obj.name=name; obj.scale=scale; obj.data.materials.append(material); return obj

def torus(name,major,minor,loc,material,col,rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=14,minor_segments=5,location=loc,rotation=rot); obj=move(bpy.context.object,col); obj.name=name; obj.data.materials.append(material); return obj

def plate(col):
    cylinder('plate:base',.54,.065,.045,M['ceramic'],col,16); cylinder('plate:well',.44,.035,.092,M['ivory'],col,16); torus('plate:rim',.49,.045,(0,0,.12),M['ivory'],col)

def bowl(col, liquid):
    bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=.39,radius2=.53,depth=.30,location=(0,0,.20)); obj=move(bpy.context.object,col); obj.data.materials.append(M['ceramic']); torus('bowl:rim',.49,.05,(0,0,.38),M['ivory'],col); cylinder('bowl:food',.455,.03,.39,liquid,col,16)

def garnish(col,z=.35,count=5,radius=.28):
    for i in range(count):
        a=tau*i/count+.27; cube(f'garnish:{i}',(cos(a)*radius,sin(a)*radius,z),(.055,.035,.025),M['green'],col,a,.005)

def crumbs(col,z,material,count=6,radius=.25):
    for i in range(count):
        a=tau*i/count+.31; sphere(f'piece:{i}',(cos(a)*radius,sin(a)*radius,z),(.07,.055,.045),material,col)

def cup(col, liquid, tall=False):
    cylinder('saucer',.50,.055,.04,M['ceramic'],col,16); cylinder('cup',.29 if not tall else .25,.38 if not tall else .55,.27 if not tall else .35,M['ivory'],col,16); cylinder('liquid',.255 if not tall else .215,.024,.47 if not tall else .63,liquid,col,16); torus('handle',.14,.045,(.29,0,.33),M['ivory'],col,(radians(90),0,0))

def build(index, recipe_id, kind):
    col=bpy.data.collections.new(f'ASSET_food_v008_{index:02d}'); bpy.context.scene.collection.children.link(col); root=bpy.data.objects.new(f'ASSET_food_v008_{index:02d}:root',None); col.objects.link(root)
    if kind in {'coffee','milkshake'}:
        cup(col, M['pink'] if kind=='milkshake' else (M['chocolate'] if recipe_id=='hot-chocolate' else M['dark']), kind=='milkshake');
        if kind=='milkshake': sphere('cream',(0,0,.70),(.22,.22,.13),M['white'],col)
    elif kind in {'soup','stew','ramen','risotto','paella','pasta','acai'}:
        liquid=M['purple'] if kind=='acai' else M['cream'] if kind in {'risotto','pasta'} else M['broth']; bowl(col,liquid)
        if kind=='ramen':
            for i in range(4): torus(f'noodle:{i}',.18+i*.035,.018,(0,0,.43+i*.01),M['gold'],col)
            cylinder('egg',.10,.04,.47,M['white'],col,12,xy=(.18,-.08)); cylinder('yolk',.055,.025,.50,M['yellow'],col,12,xy=(.18,-.08))
        elif kind=='acai': crumbs(col,.46,M['pink'],7,.27); crumbs(col,.47,M['gold'],4,.16)
        elif kind=='paella': crumbs(col,.46,M['yellow'],8,.30); crumbs(col,.48,M['fish'],5,.22)
        elif kind=='risotto': crumbs(col,.45,M['cream'],8,.28); crumbs(col,.48,M['fish'] if 'shrimp' in recipe_id else M['brown'],5,.20)
        elif kind=='pasta':
            for i in range(5): torus(f'pasta:{i}',.15+i*.04,.018,(0,0,.43+i*.008),M['gold'],col)
            cylinder('sauce',.25,.03,.48,M['red'],col,14)
        else: crumbs(col,.46,M['orange'],6,.26); crumbs(col,.47,M['white'],4,.18)
        garnish(col,.51,5,.27)
    else:
        plate(col)
        if kind=='cookies': crumbs(col,.20,M['bun'],5,.26); crumbs(col,.26,M['chocolate'],6,.20)
        elif kind=='omelette': sphere('folded',(0,0,.23),(.46,.30,.10),M['yellow'],col); garnish(col,.33,5,.24)
        elif kind=='fries':
            for i in range(12): cube(f'fry:{i}',((i%4-.5)*.11,(i//4-1)*.11,.23+i%2*.025),(.07,.30,.07),M['gold'],col,(i%3)*.18,.01)
        elif kind=='bites': crumbs(col,.23,M['gold'],7,.27)
        elif kind=='hotdog': cylinder('bun',.18,.68,.24,M['bun'],col,14,(1,1,1)); cylinder('sausage',.10,.62,.35,M['red'],col,14); cube('mustard',(0,0,.43),(.38,.035,.025),M['yellow'],col,.2,.005)
        elif kind in {'folded','tacos'}:
            count=3 if kind=='tacos' else 1
            for i in range(count): sphere(f'fold:{i}',((i-(count-1)/2)*.25,0,.25),(.24,.34,.075),M['gold'],col); crumbs(col,.36,M['red'],4,.22); garnish(col,.39,4,.24)
        elif kind=='sandwich':
            for z,ma in ((.20,M['bun']),(.27,M['pink']),(.33,M['yellow']),(.40,M['bun'])): cube(f'layer:{z}',(0,0,z),(.55,.45,.07),ma,col,.10,.018)
        elif kind=='burger':
            cylinder('bottom',.34,.10,.20,M['bun'],col); cylinder('patty',.37,.11,.30,M['brown'],col); cube('cheese',(0,0,.39),(.52,.52,.04),M['yellow'],col,.78,.01); cylinder('tomato',.34,.05,.43,M['red'],col); sphere('top',(0,0,.54),(.36,.36,.16),M['bun'],col)
        elif kind=='pancakes':
            for i in range(4): cylinder(f'pancake:{i}',.34,.065,.18+i*.06,M['gold'],col); cube('butter',(0,0,.46),(.13,.13,.07),M['yellow'],col,.2,.01)
        elif kind=='donuts':
            for i in range(3): torus(f'donut:{i}',.14,.065,((i-1)*.25,(i%2)*.10,.23),[M['pink'],M['chocolate'],M['white']][i],col)
        elif kind=='pizza' or kind=='quiche':
            cylinder('crust',.43,.10,.19,M['bun'],col,16); cylinder('top',.38,.04,.25,M['yellow'],col,16); crumbs(col,.29,M['red'],7,.28); garnish(col,.32,5,.24)
        elif kind=='pastry':
            for i in range(2): sphere(f'croissant:{i}',((i-.5)*.28,0,.23),(.28,.16,.12),M['gold'],col)
        elif kind=='lasagna':
            for i in range(5): cube(f'lasagna:{i}',(0,0,.18+i*.055),(.58,.45,.055),M['yellow'] if i%2 else M['red'],col,.06,.012)
        elif kind=='salad': crumbs(col,.24,M['green'],10,.30); crumbs(col,.29,M['white'],5,.23)
        elif kind=='sushi':
            for i in range(6): cylinder(f'sushi:{i}',.095,.11,.21,M['nori'],col,12,xy=((i%3-1)*.22,(i//3-.5)*.22)); cylinder(f'rice:{i}',.068,.025,.275,M['white'],col,12,xy=((i%3-1)*.22,(i//3-.5)*.22))
        elif kind=='dessert': cylinder('cake',.26,.22,.25,M['chocolate'],col,14); sphere('icecream',(0,0,.45),(.19,.19,.17),M['white'],col); cube('sauce',(0,-.02,.58),(.035,.35,.02),M['chocolate'],col,.2,.005)
        elif kind=='cake': cube('slice',(0,0,.26),(.48,.44,.26),M['cream'],col,.12,.025); sphere('berries',(0,0,.43),(.25,.20,.07),M['pink'],col)
        elif kind=='ribs':
            for i in range(4): cube(f'rib:{i}',((i-1.5)*.13,0,.28),(.11,.52,.14),M['brown'],col,.08,.025)
            crumbs(col,.25,M['gold'],6,.35)
        elif kind=='roast': sphere('roast',(0,0,.30),(.42,.30,.25),M['bun'],col); crumbs(col,.22,M['orange'],7,.42)
        elif kind=='lobster': sphere('lobster',(0,0,.26),(.45,.22,.14),M['sea'],col); sphere('claw-l',(-.35,.10,.28),(.16,.13,.10),M['sea'],col); sphere('claw-r',(.35,.10,.28),(.16,.13,.10),M['sea'],col)
        elif kind=='salmon': cube('salmon',(0,0,.27),(.65,.35,.17),M['fish'],col,.12,.035); [cube(f'asparagus:{i}',(-.25+i*.10,.25,.23),(.06,.48,.06),M['green'],col,.05,.01) for i in range(6)]
        elif kind=='seafood': crumbs(col,.24,M['sea'],7,.31); crumbs(col,.26,M['fish'],6,.22); crumbs(col,.27,M['white'],4,.14)
        else:
            cylinder('protein',.29,.18,.27,M['brown'],col,12,(1.25,.78,1)); crumbs(col,.22,M['gold'],7,.39); garnish(col,.39,5,.24)
    for obj in col.objects:
        if obj is not root and obj.parent is None: obj.parent=root
    col['recipeId']=recipe_id; col['referenceMode']='visual-reference-only'; return col,root

def aim(obj,target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()

def setup():
    scene=bpy.context.scene; scene.render.engine='BLENDER_EEVEE'; scene.render.image_settings.file_format='PNG'; scene.render.image_settings.color_mode='RGBA'; scene.render.film_transparent=True; scene.render.resolution_percentage=100; scene.view_settings.look='AgX - Medium High Contrast'
    camera_data=bpy.data.cameras.new('Cafe Mania food camera'); camera=bpy.data.objects.new('Cafe Mania food camera',camera_data); scene.collection.objects.link(camera); camera.location=(4.5,-6.2,4.4); camera.data.type='ORTHO'; camera.data.ortho_scale=2.25; aim(camera,(0,0,.3)); scene.camera=camera
    light_data=bpy.data.lights.new('Food key','AREA'); light_data.energy=900; light_data.shape='DISK'; light_data.size=5; light=bpy.data.objects.new('Food key',light_data); scene.collection.objects.link(light); light.location=(-3.5,-4.5,7); aim(light,(0,0,.3)); return scene,camera

def save_pixels(path,width,height,pixels):
    image=bpy.data.images.new(path.stem,width=width,height=height,alpha=True); image.pixels=pixels; image.filepath_raw=str(path); image.file_format='PNG'; image.save(); bpy.data.images.remove(image)

def render_assets(scene,assets):
    OUT.mkdir(parents=True,exist_ok=True); THUMBS.mkdir(parents=True,exist_ok=True); frame_dir=Path(os.environ['BLENDER_CODEX_OUTPUT_DIR'])/'frames'; frame_dir.mkdir(parents=True,exist_ok=True)
    for index,(col,root) in enumerate(assets,1):
        for candidate,_ in assets: candidate.hide_render=candidate is not col
        sheet=array('f',[0.0])*(FRAME*FRAME*len(DIRECTIONS)*4); representative=None
        for row,(direction,degrees) in enumerate(DIRECTIONS):
            root.rotation_euler.z=radians(degrees); scene.render.resolution_x=FRAME; scene.render.resolution_y=FRAME; frame=frame_dir/f'food_v008_{index:02d}_{direction}.png'; scene.render.filepath=str(frame); bpy.ops.render.render(write_still=True)
            image=bpy.data.images.load(str(frame),check_existing=False); pixels=array('f',image.pixels[:]); bpy.data.images.remove(image)
            if direction=='sw': representative=pixels
            for y in range(FRAME): sheet[(row*FRAME+y)*FRAME*4:(row*FRAME+y+1)*FRAME*4]=pixels[y*FRAME*4:(y+1)*FRAME*4]
        save_pixels(OUT/f'food_v008_{index:02d}.png',FRAME,FRAME*4,sheet); save_pixels(THUMBS/f'food_v008_{index:02d}.png',FRAME,FRAME,representative); root.rotation_euler.z=0

def preview(scene,camera,assets):
    for col,_ in assets: col.hide_render=False
    preview_col=bpy.data.collections.new('V008_PREVIEW'); scene.collection.children.link(preview_col)
    for index,(col,_) in enumerate(assets):
        inst=bpy.data.objects.new(f'preview:{index+1}',None); preview_col.objects.link(inst); inst.instance_type='COLLECTION'; inst.instance_collection=col; inst.location=((index%13-6)*1.15,(1.5-index//13)*1.15,0); inst.scale=(.72,.72,.72)
    camera.data.ortho_scale=16.5; aim(camera,(0,0,.25)); scene.render.resolution_x=1536; scene.render.resolution_y=720; scene.render.film_transparent=False; scene.world.color=(.045,.055,.05); scene.render.filepath=str(PREVIEW_PATH); bpy.ops.render.render(write_still=True)

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for col in list(bpy.data.collections):
    if col.name!='Collection': bpy.data.collections.remove(col)
assets=[build(index,recipe_id,kind) for index,(recipe_id,kind) in enumerate(RECIPES,1)]
scene,camera=setup(); render_assets(scene,assets); preview(scene,camera,assets)
BLEND_PATH.parent.mkdir(parents=True,exist_ok=True); bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
