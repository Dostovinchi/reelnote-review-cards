/* Public browser config only. Never put a Supabase service_role key here. */
window.FRAMIX_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  // Optional relay base URL. Leave empty to use the public relays.
  // Deploy worker/ (free Cloudflare Worker) and paste its URL here, e.g.
  // proxyBase: "https://framix-proxy.your-name.workers.dev"
  proxyBase: ""
};
