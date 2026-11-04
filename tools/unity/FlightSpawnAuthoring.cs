using UnityEngine;
public class FlightSpawnAuthoring : MonoBehaviour {
    private void OnDrawGizmos(){Gizmos.color=Color.green;Gizmos.DrawSphere(transform.position,.15f);Gizmos.DrawRay(transform.position,transform.forward*2);}
}
