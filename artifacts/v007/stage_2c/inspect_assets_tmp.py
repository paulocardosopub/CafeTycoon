import bpy
p=r"C:\Users\paulo\OneDrive\Área de Trabalho\Projetos\CafeTycoon\art_source\blender\furniture\c3_br_modular_furniture_v007_2b_1x1.blend"
bpy.ops.wm.open_mainfile(filepath=p,load_ui=False)
print('COLS', [c.name for c in bpy.data.collections if 'plant' in c.name.lower() or 'waste' in c.name.lower() or 'decor' in c.name.lower()])
print('OBJS', [o.name for o in bpy.data.objects if 'plant' in o.name.lower() or 'waste' in o.name.lower()][:100])
