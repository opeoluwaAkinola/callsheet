package com.callsheet.scheduling.api;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/** Runs the real Flyway migrations (including seed data) against an in-memory database. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class SchedulingApiIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Test
    void listsSeededProductions() throws Exception {
        mvc.perform(get("/api/productions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].title", hasItem("Northern Lights (Season 2)")));
    }

    @Test
    void shootDaysIncludeTheirAssignments() throws Exception {
        mvc.perform(get("/api/shoot-days/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unit").value("Main Unit"))
                .andExpect(jsonPath("$.assignments", hasSize(3)));
    }

    @Test
    void assigningADoubleBookedCrewMemberReturns409WithConflicts() throws Exception {
        // crew-001 is on Main Unit day 1; Second Unit day 2 overlaps it.
        mvc.perform(post("/api/shoot-days/2/assignments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"crewMemberId":"crew-001","role":"Director of Photography"}"""))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Scheduling conflict"))
                .andExpect(jsonPath("$.conflicts[0].type").value("DOUBLE_BOOKED"))
                .andExpect(jsonPath("$.conflicts[0].with.shootDayId").value(1));
    }

    @Test
    void assigningAnAvailableCrewMemberSucceeds() throws Exception {
        mvc.perform(post("/api/shoot-days/3/assignments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"crewMemberId":"crew-003","role":"Gaffer"}"""))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/assignments/")))
                .andExpect(jsonPath("$.crewMemberId").value("crew-003"));
    }

    @Test
    void conflictCheckIsADryRun() throws Exception {
        mvc.perform(post("/api/conflicts/check")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"crewMemberId":"crew-004","shootDayId":1}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ok").value(false))
                .andExpect(jsonPath("$.conflicts", hasSize(1)));

        mvc.perform(get("/api/crew/crew-004/schedule"))
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void staleVersionIsRejected() throws Exception {
        mvc.perform(patch("/api/shoot-days/3")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"version":42,"locationName":"Stage 9"}"""))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.title").value("Stale update"));
    }

    @Test
    void reschedulingIntoAConflictIsRejected() throws Exception {
        // Moving day 3 earlier would leave crew-001 only 4h rest after day 1 wraps at 19:00.
        mvc.perform(patch("/api/shoot-days/3")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"version":0,"callAt":"2026-11-02T23:00:00","wrapAt":"2026-11-03T10:00:00"}"""))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.conflicts[0].type").value("TURNAROUND_VIOLATION"));
    }

    @Test
    void validationErrorsAreProblemDetails() throws Exception {
        mvc.perform(post("/api/productions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
    }

    @Test
    void unknownShootDayIs404() throws Exception {
        mvc.perform(get("/api/shoot-days/999")).andExpect(status().isNotFound());
    }
}
