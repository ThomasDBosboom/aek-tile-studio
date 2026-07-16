$fn=64;
part="right";
frame_h=46.0; frame_t=2.2; pocket_floor=0.6; opening_h=18.5;
slot_w=17.6; slot_h=10.4; slot_r=1.1; edge_y=2.6;
side_clearance=0.1; insert_t=1.7;
left_w=209.0; right_w=232.0;
module rr(w,h,r){ offset(r=r) square([w-2*r,h-2*r]); }
module pocket_at(cx,y){ translate([cx-slot_w/2,y,pocket_floor]) linear_extrude(frame_t-pocket_floor+0.1) rr(slot_w,slot_h,slot_r); }
module left_frame(){
 xesc=4; escw=20; xf1=xesc+escw+18; xf5=xf1+77+9;
 centres=concat([xesc+escw/2],[for(i=[0:3]) xf1+9.5+19*i],[for(i=[0:3]) xf5+9.5+19*i]);
 openings=[[xesc,(frame_h-opening_h)/2,escw,opening_h,1.5],[xf1,(frame_h-opening_h)/2,77,opening_h,1.5],[xf5,(frame_h-opening_h)/2,77,opening_h,1.5]];
 difference(){
  linear_extrude(frame_t) rr(left_w,frame_h,2);
  for(o=openings) translate([o[0],o[1],-.1]) linear_extrude(frame_t+.2) rr(o[2],o[3],o[4]);
  for(cx=centres) for(y=[edge_y,frame_h-edge_y-slot_h]) pocket_at(cx,y);
 }
}
module right_frame(){
 xf9=4; xf13=90; xlights=153; xlayer=211;
 centres=concat([for(i=[0:3]) xf9+9.5+19*i],[for(i=[0:2]) xf13+9.5+19*i]);
 openings=[
  [xf9,(frame_h-opening_h)/2,77,opening_h,1.5],
  [xf13,(frame_h-opening_h)/2,57,opening_h,1.5],
  [xlights,(frame_h-opening_h)/2+1.5,52,15.5,2],
  [xlayer,(frame_h-opening_h)/2-1,19,20.5,2]
 ];
 difference(){
  linear_extrude(frame_t) rr(right_w,frame_h,2);
  for(o=openings) translate([o[0],o[1],-.1]) linear_extrude(frame_t+.2) rr(o[2],o[3],o[4]);
  for(cx=centres) for(y=[edge_y,frame_h-edge_y-slot_h]) pocket_at(cx,y);
 }
}
module icon_insert(){ linear_extrude(insert_t) rr(slot_w-2*side_clearance,slot_h-2*side_clearance,1); }
if(part=="left") left_frame(); else if(part=="right") right_frame(); else icon_insert();
