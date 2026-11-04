# UV and flight verification

The nine Blender images show actual repaired source objects from three angles.
They use temporary unlit material copies to expose atlas correspondence clearly;
they are diagnostic views, not the game's lighting or artistic acceptance.
The saved map materials, geometry and lighting were not changed for these renders.

| Source map | Representative atlas | Front view | Other angles |
| --- | --- | --- | --- |
| Minus Two | TornPosters01 | [Poster](minus-two-demo-0.png) | [Left](minus-two-demo--25.png), [right](minus-two-demo-25.png) |
| Hangar C03 | TrafficSignStop01 | [Stop sign](hangar-c03-demo-0.png) | [Left](hangar-c03-demo--25.png), [right](hangar-c03-demo-25.png) |
| Liftoff Arena | BannerArena02 | [Banner](liftoff-arena-demo-0.png) | [Left](liftoff-arena-demo--25.png), [right](liftoff-arena-demo-25.png) |

[Source object names](sources.json), [compressed delivery atlas comparison](atlas-audit.json),
[17 unchanged texture-binding/geometry-count checks](delivery-preservation.json).
The atlas comparison matches 1,516/1,516 source vertices across all three maps.

[Local Low flight](local-low-flight.png) uses the rebuilt client, Low quality,
256 px textures and disabled adaptive resolution. Movement and a small forward
pitch were observed in Minus Two before reducing throttle for landing.
[Hangar](local-low-hangar-flight.png) and [Arena](local-low-arena-scene.png)
are stationary Low scene checks. This is visual QA, not a UHD 620 FPS measurement.
The observed 1,076×605 viewport rendered at 874×491; no 720p performance claim.

[Public Low scene](public-low-minus-two.png) verifies guest flight/rendering on
the deployed site. In-app key-hold delivery was unreliable and is excluded from
public keyboard acceptance. The exact takeoff trigger was instead verified with
[live authoritative input frames](public-takeoff.json): grounded Kestrel and
Luma climbed 2.16 m / 2.37 m at 50% throttle plus launch pitch, without crashing.

Production publication and backup results belong in
[the deployment record](../ORACLE-DEPLOYMENT.md).
