package com.scorebook.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/**
 * 比赛记录，对应原云开发集合 match_records。
 * 主键自增；space_id 关联 spaces.id（见 schema.sql 上的索引）。
 * time 用 BIGINT 存 epoch 毫秒，和原前端传值保持一致。
 */
@Entity
@Table(name = "match_records", indexes = {
        @Index(name = "idx_records_space", columnList = "space_id"),
        @Index(name = "idx_records_space_time", columnList = "space_id, time")
})
public class MatchRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "space_id")
    private Long spaceId;

    @Column(name = "type", length = 32)
    private String type;

    /** 比赛时间，epoch 毫秒 */
    @Column(name = "time")
    private Long time;

    @Column(name = "loc", length = 128)
    private String loc;

    @Column(name = "duration")
    private Integer duration;

    /** A 方得分 */
    @Column(name = "a")
    private Integer a;

    /** B 方得分 */
    @Column(name = "b")
    private Integer b;

    /** 金额（选填）：赢家赢得的金额，单位元；不填为 null */
    @Column(name = "amount", precision = 10, scale = 2)
    private java.math.BigDecimal amount;

    /** 胜方：me / friend / draw */
    @Column(name = "winner", length = 16)
    private String winner;

    @Column(name = "creator_openid", length = 64)
    private String creatorOpenid;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getSpaceId() {
        return spaceId;
    }

    public void setSpaceId(Long spaceId) {
        this.spaceId = spaceId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Long getTime() {
        return time;
    }

    public void setTime(Long time) {
        this.time = time;
    }

    public String getLoc() {
        return loc;
    }

    public void setLoc(String loc) {
        this.loc = loc;
    }

    public Integer getDuration() {
        return duration;
    }

    public void setDuration(Integer duration) {
        this.duration = duration;
    }

    public Integer getA() {
        return a;
    }

    public void setA(Integer a) {
        this.a = a;
    }

    public Integer getB() {
        return b;
    }

    public void setB(Integer b) {
        this.b = b;
    }

    public java.math.BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(java.math.BigDecimal amount) {
        this.amount = amount;
    }

    public String getWinner() {
        return winner;
    }

    public void setWinner(String winner) {
        this.winner = winner;
    }

    public String getCreatorOpenid() {
        return creatorOpenid;
    }

    public void setCreatorOpenid(String creatorOpenid) {
        this.creatorOpenid = creatorOpenid;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
