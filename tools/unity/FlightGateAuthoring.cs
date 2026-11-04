using UnityEngine;
public class FlightGateAuthoring : MonoBehaviour {
    public int order;
    public string courseId="my-map-course";
    public float width=6,height=5;
    private void OnDrawGizmos(){Gizmos.color=Color.cyan;Gizmos.matrix=Matrix4x4.TRS(transform.position,transform.rotation,Vector3.one);Gizmos.DrawWireCube(Vector3.zero,new Vector3(width,height,.2f));}
}
