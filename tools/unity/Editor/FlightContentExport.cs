#if UNITY_EDITOR
using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEngine;
using UnityEditor;
using UnityGLTF;

public static class FlightContentExport {
    [Serializable] class MapData {
        public string id,name,region,description="",theme="custom",model="model.glb";
        public string sky,fog,ground,sun,collisionFile="collision.json";
        public float[] sunPosition,wind;public float gravity=1;
        public ColliderData[] colliders=new ColliderData[0];
    }
    [Serializable] class GateData {public float[] position;public float yaw,width,height;}
    [Serializable] class SpawnData {public float[] position;public float yaw;}
    [Serializable] class RaceData {public string id,name,map;public int laps;public SpawnData spawn;public GateData[] gates;}
    [Serializable] class ColliderData {public string type="mesh";public float[] vertices;}
    static float[] Position(Vector3 v){return new[]{-v.x,v.y,v.z};} // UnityGLTF reflects X to glTF coordinates.
    static void Write(string path,object data){Directory.CreateDirectory(Path.GetDirectoryName(path));File.WriteAllText(path,JsonUtility.ToJson(data,true));}
    static void Triangle(List<float> output,Transform transform,Vector3 a,Vector3 b,Vector3 c){output.AddRange(Position(transform.TransformPoint(a)));output.AddRange(Position(transform.TransformPoint(c)));output.AddRange(Position(transform.TransformPoint(b)));}
    [MenuItem("Parvoz Drone Simulator/Export selected map to content folder")]
    public static void Export() {
        var root=Selection.activeGameObject?Selection.activeGameObject.GetComponent<FlightMapAuthoring>():null;
        if(!root){EditorUtility.DisplayDialog("Export map","Select the map root with FlightMapAuthoring.","OK");return;}
        if(!Regex.IsMatch(root.id,"^[a-z0-9][a-z0-9-]{1,63}$"))throw new Exception("Use a lowercase map ID with letters, digits and hyphens.");
        if(root.transform.parent||root.transform.position!=Vector3.zero||root.transform.rotation!=Quaternion.identity||root.transform.lossyScale!=Vector3.one)throw new Exception("Map root must have no parent, position 0, rotation 0, scale 1. Move its child objects instead.");
        var gates=root.GetComponentsInChildren<FlightGateAuthoring>().OrderBy(g=>g.order).ToArray();
        var spawn=root.GetComponentInChildren<FlightSpawnAuthoring>();if(!spawn||gates.Length==0)throw new Exception("Add a spawn and at least one gate.");
        if(root.laps<1||root.laps>20||root.gravity<.1f||root.gravity>3)throw new Exception("Use 1–20 laps and gravity 0.1–3.");
        foreach(var course in gates.GroupBy(g=>g.courseId)){if(!Regex.IsMatch(course.Key,"^[a-z0-9][a-z0-9-]{1,63}$"))throw new Exception("Invalid course ID: "+course.Key);if(course.Select(g=>g.order).Distinct().Count()!=course.Count())throw new Exception("Gate orders must be unique in each course.");if(course.Any(g=>g.width<.3f||g.width>100||g.height<.3f||g.height>100))throw new Exception("Gate width and height must be 0.3–100 metres.");}
        var triangles=new List<float>();
        foreach(var collider in root.GetComponentsInChildren<Collider>().Where(c=>c.enabled&&!c.isTrigger)) {
            var mesh=collider as MeshCollider;
            if(mesh&&mesh.sharedMesh){var vertices=mesh.sharedMesh.vertices;var indices=mesh.sharedMesh.triangles;for(int n=0;n<indices.Length;n+=3)Triangle(triangles,mesh.transform,vertices[indices[n]],vertices[indices[n+1]],vertices[indices[n+2]]);}
            else if(collider is BoxCollider box){var points=new Vector3[8];for(int n=0;n<8;n++)points[n]=box.center+Vector3.Scale(box.size*.5f,new Vector3((n&1)==0?-1:1,(n&2)==0?-1:1,(n&4)==0?-1:1));int[] faces={0,2,3,0,3,1,4,5,7,4,7,6,0,1,5,0,5,4,2,6,7,2,7,3,0,4,6,0,6,2,1,3,7,1,7,5};for(int n=0;n<faces.Length;n+=3)Triangle(triangles,box.transform,points[faces[n]],points[faces[n+1]],points[faces[n+2]]);}
            else throw new Exception("Use BoxCollider or readable MeshCollider for static map collision. Unsupported: "+collider.name);
        }
        if(triangles.Count>900000)throw new Exception("Collision limit: 100,000 triangles. Simplify collision meshes; keep visual detail separate.");
        if(triangles.Count==0)throw new Exception("Add collision to the ground and obstacles before export.");
        var folder=Path.Combine(Path.GetFullPath(root.contentFolder),"maps",root.id);Directory.CreateDirectory(folder);
        new GLTFSceneExporter(new[]{root.transform},new ExportContext()).SaveGLB(folder,"model");
        var data=new MapData{id=root.id,name=root.displayName,region=root.region,sky="#"+ColorUtility.ToHtmlStringRGB(root.sky),fog="#"+ColorUtility.ToHtmlStringRGB(root.fog),ground="#"+ColorUtility.ToHtmlStringRGB(root.ground),sun="#"+ColorUtility.ToHtmlStringRGB(root.sun),sunPosition=Position(root.sunPosition),wind=Position(root.wind),gravity=root.gravity};
        Write(Path.Combine(folder,"map.json"),data);
        // JsonUtility cannot write a root array: strip the temporary wrapper.
        var collision=JsonUtility.ToJson(new CollisionList{items=new[]{new ColliderData{vertices=triangles.ToArray()}}},true);
        File.WriteAllText(Path.Combine(folder,"collision.json"),collision.Substring(collision.IndexOf('['),collision.LastIndexOf(']')-collision.IndexOf('[')+1));
        foreach(var course in gates.GroupBy(g=>g.courseId)) {
            if(!Regex.IsMatch(course.Key,"^[a-z0-9][a-z0-9-]{1,63}$"))throw new Exception("Invalid course ID: "+course.Key);
            if(course.Select(g=>g.order).Distinct().Count()!=course.Count())throw new Exception("Gate orders must be unique in each course.");
            var race=new RaceData{id=course.Key,name=course.Key,map=root.id,laps=root.laps,spawn=new SpawnData{position=Position(spawn.transform.position),yaw=-spawn.transform.eulerAngles.y*Mathf.Deg2Rad},gates=course.Select(g=>new GateData{position=Position(g.transform.position),yaw=-g.transform.eulerAngles.y*Mathf.Deg2Rad,width=g.width,height=g.height}).ToArray()};
            Write(Path.Combine(root.contentFolder,"races",course.Key,"race.json"),race);
        }
        Debug.Log("Parvoz Drone Simulator content exported to "+folder+". Keep npm start running; the main menu refreshes the catalog.");
    }
    [Serializable] class CollisionList {public ColliderData[] items;}
}
#endif
