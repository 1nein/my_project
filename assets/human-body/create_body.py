import bpy
import math
import json
from pathlib import Path
from mathutils import Vector, Quaternion

OUT = Path(__file__).resolve().parent
scene = bpy.data.scenes.new('Body Selector')
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
regions = []
mat = bpy.data.materials.new('Body | soft teal')
mat.diffuse_color = (0.38, 0.64, 0.65, 1)
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value = mat.diffuse_color
bsdf.inputs['Roughness'].default_value = 0.72

def finish(obj, name, label):
    obj.name = name
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    obj['region_id'] = name
    obj['label_ko'] = label
    for poly in obj.data.polygons:
        poly.use_smooth = True
    regions.append({'id': name, 'label': label})
    return obj

def loft(name, label, rings, sides=24):
    verts = []
    for x, y, z, rx, ry in rings:
        for j in range(sides):
            a = j * 2 * math.pi / sides
            verts.append((x + rx * math.cos(a), y + ry * math.sin(a), z))
    faces = []
    for k in range(len(rings)-1):
        for j in range(sides):
            a = k*sides+j
            b = k*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.append(tuple(reversed(range(sides))))
    faces.append(tuple((len(rings)-1)*sides+j for j in range(sides)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return finish(obj, name, label)

def ellipsoid(name, label, location, scale, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, label)

loft('pelvis', '골반', [(0,0,.79,.075,.067),(0,0,.83,.125,.085),(0,.005,.89,.151,.096),(0,.003,.95,.146,.093),(0,0,1.00,.129,.086)])
loft('abdomen', '복부 / 허리', [(0,0,1.00,.129,.086),(0,0,1.05,.123,.084),(0,0,1.10,.129,.089),(0,0,1.15,.145,.098)])
loft('chest', '가슴 / 등', [(0,0,1.15,.145,.098),(0,0,1.21,.166,.106),(0,.005,1.28,.185,.103),(0,.008,1.33,.182,.089),(0,.009,1.36,.148,.076),(0,.008,1.39,.078,.060)])
loft('neck', '목', [(0,.008,1.365,.058,.053),(0,.008,1.40,.054,.049),(0,.006,1.45,.049,.047),(0,.002,1.49,.057,.053)])
loft('head', '머리', [(0,-.018,1.455,.033,.038),(0,-.015,1.473,.055,.061),(0,-.006,1.51,.075,.072),(0,.002,1.56,.086,.080),(0,.007,1.61,.086,.081),(0,.01,1.65,.074,.069),(0,.012,1.68,.049,.046),(0,.012,1.692,.009,.009)],32)

# +X is the person's left; the model faces -Y in Blender (+Z in glTF).
for side, sign, ko in [('left',1,'왼쪽'),('right',-1,'오른쪽')]:
    def rs(rows):
        return [(sign*x,y,z,rx,ry) for x,y,z,rx,ry in rows]
    loft(side+'_upper_arm', ko+' 위팔 / 어깨', rs([(.299,0,1.074,.039,.041),(.280,0,1.13,.047,.049),(.248,.003,1.21,.058,.059),(.217,.005,1.28,.065,.067),(.193,.006,1.326,.055,.058),(.179,.007,1.347,.021,.029)]))
    loft(side+'_elbow',ko+' 팔꿈치',rs([(.312,0,1.036,.037,.039),(.306,0,1.055,.041,.043),(.299,0,1.074,.039,.041)]))
    loft(side+'_forearm',ko+' 아래팔',rs([(.368,-.007,.85,.024,.028),(.354,-.004,.906,.030,.035),(.336,0,.97,.039,.043),(.322,0,1.013,.040,.043),(.312,0,1.036,.037,.039)]))
    loft(side+'_wrist',ko+' 손목',rs([(.375,-.009,.823,.024,.027),(.368,-.007,.85,.024,.028)]))
    hand=loft(side+'_hand',ko+' 손',rs([(.396,-.016,.711,.011,.014),(.395,-.016,.72,.026,.020),(.392,-.015,.75,.034,.024),(.385,-.012,.786,.033,.026),(.375,-.009,.823,.024,.027)]))
    thumb=ellipsoid('thumb_temp',ko+' 손', (sign*.354,-.024,.772),(.016,.019,.038),16,12)
    regions.pop()
    bpy.ops.object.select_all(action='DESELECT')
    hand.select_set(True)
    thumb.select_set(True)
    bpy.context.view_layer.objects.active=hand
    bpy.ops.object.join()
    loft(side+'_thigh',ko+' 허벅지',rs([(.102,.006,.484,.051,.055),(.101,.004,.55,.061,.066),(.094,.006,.66,.077,.080),(.084,.008,.77,.084,.087),(.080,.006,.84,.079,.081),(.078,.002,.873,.059,.062)]))
    loft(side+'_knee',ko+' 무릎',rs([(.105,.006,.428,.047,.048),(.104,-.001,.452,.052,.055),(.102,.006,.484,.051,.055)]))
    loft(side+'_shin',ko+' 종아리 / 정강이',rs([(.115,.01,.132,.032,.034),(.113,.012,.19,.035,.039),(.111,.020,.28,.046,.053),(.108,.021,.35,.053,.057),(.105,.006,.428,.047,.048)]))
    loft(side+'_ankle',ko+' 발목',rs([(.116,.009,.090,.034,.037),(.115,.01,.132,.032,.034)]))
    loft(side+'_foot',ko+' 발',rs([(.116,-.049,.014,.039,.093),(.116,-.052,.025,.048,.111),(.116,-.050,.046,.051,.113),(.116,-.040,.067,.046,.092),(.116,-.013,.09,.034,.056),(.116,.009,.107,.027,.031)]))

bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = bpy.data.objects['chest']
scene.world = bpy.data.worlds.new('Body World')
scene.world.color = (.18,.18,.18)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            space = area.spaces.active
            space.shading.type = 'SOLID'
            space.shading.color_type = 'MATERIAL'
            space.shading.light = 'STUDIO'
            space.shading.show_shadows = True
            space.shading.show_cavity = True
            space.overlay.show_floor = False
            space.overlay.show_axis_x = False
            space.overlay.show_axis_y = False
            space.region_3d.view_rotation = Quaternion((1,0,0),math.pi/2)
            space.region_3d.view_distance = 2.5
            space.region_3d.view_location = Vector((0,0,.85))
            space.region_3d.view_perspective = 'ORTHO'

bpy.ops.export_scene.gltf(filepath=str(OUT/'human-body.glb'), export_format='GLB', use_selection=True, export_extras=True, export_yup=True)
triangles = sum(len(p.vertices)-2 for o in scene.objects if o.type=='MESH' for p in o.data.polygons)
(OUT/'regions.json').write_text(json.dumps({'height_m':1.692,'front_gltf':'+Z','left_right':'anatomical','triangles':triangles,'regions':regions},ensure_ascii=False,indent=2))
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'human-body.blend'))
print('BODY_READY', len(regions), 'regions;',triangles,'triangles;', (OUT/'human-body.glb').stat().st_size,'bytes')
