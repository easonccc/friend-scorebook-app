package com.scorebook.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/**
 * 用户表，对应原云开发集合 users。
 * 主键用 openid（原 _id = openid），所以不需要额外自增 id。
 */
@Entity
@Table(name = "users")
public class User {

    /** 微信 openid，全局唯一，作为主键 */
    @Id
    @Column(name = "openid", length = 64)
    private String openid;

    @Column(name = "nickname", length = 32)
    private String nickname;

    /** 头像标识，如 avatar_01，必须是预置白名单里的，不能有自定义图片 */
    @Column(name = "avatar", length = 32)
    private String avatar;

    /** 角色：user / admin。由后端判定，前端不可改 */
    @Column(name = "role", length = 16, nullable = false)
    private String role = "user";

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public String getOpenid() {
        return openid;
    }

    public void setOpenid(String openid) {
        this.openid = openid;
    }

    public String getNickname() {
        return nickname;
    }

    public void setNickname(String nickname) {
        this.nickname = nickname;
    }

    public String getAvatar() {
        return avatar;
    }

    public void setAvatar(String avatar) {
        this.avatar = avatar;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
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
