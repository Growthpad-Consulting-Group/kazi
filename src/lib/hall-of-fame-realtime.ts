import { supabaseAdmin } from "@/lib/supabase";
import { hallOfFameChannelName } from "@/lib/hall-of-fame-channel";

export async function broadcastHallOfFameChange(cycleId: string) {
  const channel = supabaseAdmin.channel(hallOfFameChannelName(cycleId));
  await channel.send({ type: "broadcast", event: "changed", payload: {} });
  await supabaseAdmin.removeChannel(channel);
}
