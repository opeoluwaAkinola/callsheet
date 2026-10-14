package com.callsheet.scheduling.domain;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "shoot_day")
public class ShootDay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "production_id")
    private Production production;

    @Column(nullable = false)
    private String unit;

    @Column(name = "location_name", nullable = false)
    private String locationName;

    @Column(name = "call_at", nullable = false)
    private LocalDateTime callAt;

    @Column(name = "wrap_at", nullable = false)
    private LocalDateTime wrapAt;

    private String notes;

    /** Optimistic lock: two coordinators editing the same day can't silently overwrite each other. */
    @Version
    private long version;

    @OneToMany(mappedBy = "shootDay", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<Assignment> assignments = new ArrayList<>();

    protected ShootDay() {}

    public ShootDay(Production production, String unit, String locationName,
                    LocalDateTime callAt, LocalDateTime wrapAt, String notes) {
        this.production = production;
        this.unit = unit;
        this.locationName = locationName;
        this.callAt = callAt;
        this.wrapAt = wrapAt;
        this.notes = notes;
    }

    public void reschedule(String locationName, LocalDateTime callAt, LocalDateTime wrapAt, String notes) {
        if (locationName != null) this.locationName = locationName;
        if (callAt != null) this.callAt = callAt;
        if (wrapAt != null) this.wrapAt = wrapAt;
        if (notes != null) this.notes = notes;
        if (!this.wrapAt.isAfter(this.callAt)) {
            throw new IllegalArgumentException("wrapAt must be after callAt");
        }
    }

    public Long getId() { return id; }
    public Production getProduction() { return production; }
    public String getUnit() { return unit; }
    public String getLocationName() { return locationName; }
    public LocalDateTime getCallAt() { return callAt; }
    public LocalDateTime getWrapAt() { return wrapAt; }
    public String getNotes() { return notes; }
    public long getVersion() { return version; }
    public List<Assignment> getAssignments() { return assignments; }
}
