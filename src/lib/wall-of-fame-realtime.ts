import { supabaseAdmin } from "@/lib/supabase";
import { wallOfFameChannelName } from "@/lib/wall-of-fame-channel";

export async function broadcastWallOfFameChange(cycleId: string) {
  const channel = supabaseAdmin.channel(wallOfFameChannelName(cycleId));
  await channel.send({ type: "broadcast", event: "changed", payload: {} });
  await supabaseAdmin.removeChannel(channel);
}
