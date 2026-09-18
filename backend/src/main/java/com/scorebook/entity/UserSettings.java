package com.scorebook.entity;

import com.scorebook.common.JsonStringListConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 用户设置，对应原云开发集合 user_settings。
 * 一人一条，openid 当主键。
 */
@Entity
@Table(name = "user_settings")
public class UserSettings {

    @Id
    @Column(name = "openid", length = 64)
    private String openid;

    /** 默认比赛类型，如 台球 */
    @Column(name = "default_type", length = 32)
    private String defaultType;

    /** 默认进入的空间 id（关联 spaces.id） */
    @Column(name = "default_space_id", length = 64)
    private String defaultSpaceId;

    /** 我的自定义比赛类型（字符串数组），JSON 列存储 */
    @Convert(converter = JsonStringListConverter.class)
    @Column(name = "custom_types", columnDefinition = "json")
    private List<String> customTypes = new ArrayList<>();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public String getOpenid() {
        return openid;
    }

    public void setOpenid(String openid) {
        this.openid = openid;
    }

    public String getDefaultType() {
        return defaultType;
    }

    public void setDefaultType(String defaultType) {
        this.defaultType = defaultType;
    }

    public String getDefaultSpaceId() {
        return defaultSpaceId;
    }

    public void setDefaultSpaceId(String defaultSpaceId) {
        this.defaultSpaceId = defaultSpaceId;
    }

    public List<String> getCustomTypes() {
        return customTypes;
    }

    public void setCustomTypes(List<String> customTypes) {
        this.customTypes = customTypes;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
