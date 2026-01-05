const DashboardPreview = () => {
  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      <div className="container relative z-10">
        <div className="mx-auto max-w-2xl text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            A dashboard that{" "}
            <span className="gradient-text">works for you</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Intuitive interface designed for speed and clarity
          </p>
        </div>

        {/* Dashboard mockup */}
        <div className="relative mx-auto max-w-5xl">
          {/* Glow effect behind */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-cyan-500/20 to-primary/20 blur-3xl opacity-50 scale-105" />
          
          {/* Dashboard frame */}
          <div className="relative glass rounded-2xl p-2 glow-border">
            <div className="bg-card rounded-xl overflow-hidden">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-secondary/50 border-b border-border">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 bg-background/50 rounded-md text-xs text-muted-foreground">
                    app.synapilot.io/dashboard
                  </div>
                </div>
              </div>

              {/* Dashboard content */}
              <div className="p-6 min-h-[400px] bg-background/50">
                <div className="grid lg:grid-cols-4 gap-6">
                  {/* Sidebar */}
                  <div className="hidden lg:block space-y-4">
                    <div className="space-y-2">
                      {["Dashboard", "Projects", "Clients", "Team", "Reports"].map((item, i) => (
                        <div
                          key={item}
                          className={`px-3 py-2 rounded-lg text-sm ${
                            i === 0 ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
                          }`}
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Main content */}
                  <div className="lg:col-span-3 space-y-6">
                    {/* Stats row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: "Active Projects", value: "24" },
                        { label: "Team Members", value: "18" },
                        { label: "Revenue MTD", value: "$84.2K" },
                        { label: "Client Satisfaction", value: "98%" },
                      ].map((stat) => (
                        <div key={stat.label} className="p-4 rounded-xl bg-secondary/50 border border-border">
                          <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
                          <div className="font-display text-2xl font-bold text-foreground">{stat.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Chart placeholder */}
                    <div className="p-6 rounded-xl bg-secondary/30 border border-border">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium">Revenue Overview</span>
                        <span className="text-xs text-muted-foreground">Last 6 months</span>
                      </div>
                      <div className="flex items-end gap-2 h-32">
                        {[40, 65, 45, 80, 55, 90].map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 bg-primary/30 rounded-t-md hover:bg-primary/50 transition-colors"
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Recent projects */}
                    <div className="p-4 rounded-xl bg-secondary/30 border border-border">
                      <div className="text-sm font-medium mb-3">Recent Projects</div>
                      <div className="space-y-2">
                        {[
                          { name: "Website Redesign", client: "TechCorp", status: "In Progress" },
                          { name: "Mobile App", client: "StartupXYZ", status: "Review" },
                          { name: "Brand Identity", client: "Retail Co", status: "Completed" },
                        ].map((project) => (
                          <div key={project.name} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/50">
                            <div>
                              <div className="text-sm font-medium">{project.name}</div>
                              <div className="text-xs text-muted-foreground">{project.client}</div>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              project.status === "Completed" ? "bg-green-500/10 text-green-400" :
                              project.status === "Review" ? "bg-yellow-500/10 text-yellow-400" :
                              "bg-primary/10 text-primary"
                            }`}>
                              {project.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DashboardPreview;
