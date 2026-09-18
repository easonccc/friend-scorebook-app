package com.scorebook.entity;

import com.scorebook.common.JsonStringListConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 比赛空间，对应原云开发集合 spaces。
 * 主键用数据库自增 id（原云开发的 _id 不再使用）。
 */
@Entity
@Table(name = "spaces")
public class Space {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "name", length = 64)
    private String name;

    /** 6 位邀请码，服务端生成，全局唯一（见 @Table 上的唯一索引由 schema.sql 保证） */
    @Column(name = "invite_code", length = 6, unique = true)
    private String inviteCode;

    @Column(name = "creator_openid", length = 64)
    private String creatorOpenid;

    @Column(name = "player_a_name", length = 32)
    private String playerAName;

    @Column(name = "player_b_name", length = 32)
    private String playerBName;

    /** 空间成员 openid 列表，JSON 列存储 */
    @Convert(converter = JsonStringListConverter.class)
    @Column(name = "members", columnDefinition = "json")
    private List<String> members = new ArrayList<>();

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getInviteCode() {
        return inviteCode;
    }

    public void setInviteCode(String inviteCode) {
        this.inviteCode = inviteCode;
    }

    public String getCreatorOpenid() {
        return creatorOpenid;
    }

    public void setCreatorOpenid(String creatorOpenid) {
        this.creatorOpenid = creatorOpenid;
    }

    public String getPlayerAName() {
        return playerAName;
    }

    public void setPlayerAName(String playerAName) {
        this.playerAName = playerAName;
    }

    public String getPlayerBName() {
        return playerBName;
    }

    public void setPlayerBName(String playerBName) {
        this.playerBName = playerBName;
    }

    public List<String> getMembers() {
        return members;
    }

    public void setMembers(List<String> members) {
        this.members = members;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
