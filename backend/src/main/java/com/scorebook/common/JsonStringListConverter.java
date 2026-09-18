package com.scorebook.common;

// 注意：Spring Boot 4.1 自带 Jackson 3.x，包名已从 com.fasterxml.jackson.* 改为 tools.jackson.*
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.List;
import tools.jackson.core.JsonProcessingException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * 把 List<String> 与数据库里的 JSON 文本互转。
 *
 * 为什么需要它：MySQL 的 JSON 列存的是 JSON 文本（如 ["o123","o456"]）。
 * 如果在实体里直接写 List<String>，Hibernate 各版本对 JSON 的处理不太一致，容易踩坑。
 * 用这个转换器最稳：实体里用 List<String>（好用），落库时自动序列化成 JSON 字符串，
 * 读库时自动解析回 List<String>。
 *
 * 怎么用：在实体字段上写 @Convert(converter = JsonStringListConverter.class) 即可。
 */
@Converter
public class JsonStringListConverter implements AttributeConverter<List<String>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public String convertToDatabaseColumn(List<String> list) {
        try {
            return MAPPER.writeValueAsString(list == null ? List.of() : list);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("List<String> 转 JSON 失败", e);
        }
    }

    @Override
    public List<String> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return List.of();
        }
        try {
            return MAPPER.readValue(dbData, new TypeReference<List<String>>() {});
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }
}
