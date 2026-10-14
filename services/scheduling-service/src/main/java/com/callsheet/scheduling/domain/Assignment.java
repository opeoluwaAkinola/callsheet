package com.callsheet.scheduling.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "assignment")
public class Assignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "shoot_day_id")
    private ShootDay shootDay;

    /** Owned by crew-service (MongoDB); stored here as an opaque reference. */
    @Column(name = "crew_member_id", nullable = false)
    private String crewMemberId;

    @Column(nullable = false)
    private String role;

    protected Assignment() {}

    public Assignment(ShootDay shootDay, String crewMemberId, String role) {
        this.shootDay = shootDay;
        this.crewMemberId = crewMemberId;
        this.role = role;
    }

    public Long getId() { return id; }
    public ShootDay getShootDay() { return shootDay; }
    public String getCrewMemberId() { return crewMemberId; }
    public String getRole() { return role; }
}
