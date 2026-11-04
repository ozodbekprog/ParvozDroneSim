using UnityEngine;
public class FlightMapAuthoring : MonoBehaviour {
    public string id="my-map", displayName="My Map", region="Custom map";
    public string contentFolder="C:/DroneLiftoffUz/content";
    public int laps=1;
    public Color sky=new Color(.57f,.70f,.81f), fog=new Color(.60f,.70f,.73f), ground=new Color(.47f,.49f,.47f), sun=new Color(1,.95f,.80f);
    public Vector3 sunPosition=new Vector3(68,95,45), wind=Vector3.zero;
    public float gravity=1;
}
