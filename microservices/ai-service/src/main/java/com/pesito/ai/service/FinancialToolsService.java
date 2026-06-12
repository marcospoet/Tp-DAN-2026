package com.pesito.ai.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.pesito.ai.tool.ToolCall;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Ejecuta las tools del agente sobre transaction-service.
 * Las agregaciones (balances, resumen mensual) se calculan acá a partir de
 * GET /api/transactions, ya que transaction-service no expone endpoints dedicados.
 */
@Service
public class FinancialToolsService {

    private final WebClient transactionServiceWebClient;
    private final ObjectMapper mapper;

    public FinancialToolsService(@Qualifier("transactionServiceWebClient") WebClient transactionServiceWebClient,
                                  ObjectMapper mapper) {
        this.transactionServiceWebClient = transactionServiceWebClient;
        this.mapper = mapper;
    }

    /**
     * Ejecuta una tool y devuelve su resultado serializado como JSON, listo para
     * inyectarse como tool_result en la conversación con el LLM.
     */
    public String execute(String userId, ToolCall call) {
        try {
            return switch (call.name()) {
                case "get_account_balances" -> getAccountBalances(userId);
                case "get_transactions" -> getTransactions(userId, call.arguments());
                case "get_monthly_summary" -> getMonthlySummary(userId, call.arguments());
                case "create_transaction" -> createTransaction(userId, call.arguments());
                case "update_transaction" -> updateTransaction(userId, call.arguments());
                case "delete_transaction" -> deleteTransaction(userId, call.arguments());
                case "get_exchange_rate" -> getExchangeRate(call.arguments());
                default -> errorJson("Tool desconocida: " + call.name());
            };
        } catch (WebClientResponseException e) {
            return errorJson("Error consultando transaction-service (" + e.getStatusCode() + "): " + e.getMessage());
        } catch (Exception e) {
            return errorJson("Error ejecutando la tool '" + call.name() + "': " + e.getMessage());
        }
    }

    // ── Tools ─────────────────────────────────────────────────────────────────

    private String getAccountBalances(String userId) throws Exception {
        List<TxItem> txs = fetchTransactions(userId, null, null);

        Map<String, BigDecimal> balances = new LinkedHashMap<>();
        for (TxItem tx : txs) {
            BigDecimal signed = "INCOME".equalsIgnoreCase(tx.type()) ? tx.amount() : tx.amount().negate();
            String account = tx.account() == null || tx.account().isBlank() ? "Sin cuenta" : tx.account();
            balances.merge(account, signed, BigDecimal::add);
        }

        ObjectNode result = mapper.createObjectNode();
        ArrayNode arr = result.putArray("balances");
        balances.forEach((account, balance) -> {
            ObjectNode node = arr.addObject();
            node.put("account", account);
            node.put("balance", balance);
        });
        result.put("note", "Balance calculado como suma de ingresos menos egresos registrados; no es un saldo bancario en tiempo real.");
        return mapper.writeValueAsString(result);
    }

    private String getTransactions(String userId, JsonNode args) throws Exception {
        LocalDate from = parseDate(args, "date_from");
        LocalDate to = parseDate(args, "date_to");
        String category = textOrNull(args, "category");
        String account = textOrNull(args, "account");
        String type = textOrNull(args, "type");

        List<TxItem> filtered = fetchTransactions(userId, from, to).stream()
                .filter(tx -> category == null || category.equalsIgnoreCase(tx.category()))
                .filter(tx -> account == null || account.equalsIgnoreCase(tx.account()))
                .filter(tx -> type == null || type.equalsIgnoreCase(tx.type()))
                .limit(50)
                .toList();

        ObjectNode result = mapper.createObjectNode();
        ArrayNode arr = result.putArray("transactions");
        for (TxItem tx : filtered) {
            ObjectNode node = arr.addObject();
            node.put("id", tx.id());
            node.put("description", tx.description());
            node.put("amount", tx.amount());
            node.put("type", tx.type());
            node.put("category", tx.category());
            node.put("date", tx.date().toString());
            node.put("account", tx.account());
            node.put("currency", tx.currency());
        }
        result.put("count", filtered.size());
        return mapper.writeValueAsString(result);
    }

    private String getMonthlySummary(String userId, JsonNode args) throws Exception {
        String month = textOrNull(args, "month");
        if (month == null) {
            return errorJson("Falta el parámetro 'month' (formato YYYY-MM).");
        }
        return getMonthlySummaryJson(userId, YearMonth.parse(month));
    }

    /**
     * Resumen mensual reusable: lo consume la tool get_monthly_summary y la
     * generación del perfil financiero semántico (UserProfileService).
     */
    public String getMonthlySummaryJson(String userId, YearMonth ym) throws Exception {
        String month = ym.toString();
        List<TxItem> txs = fetchTransactions(userId, ym.atDay(1), ym.atEndOfMonth());

        BigDecimal income = BigDecimal.ZERO;
        BigDecimal expense = BigDecimal.ZERO;
        Map<String, BigDecimal> byCategory = new LinkedHashMap<>();
        for (TxItem tx : txs) {
            if ("INCOME".equalsIgnoreCase(tx.type())) {
                income = income.add(tx.amount());
            } else {
                expense = expense.add(tx.amount());
                String category = tx.category() == null || tx.category().isBlank() ? "Sin categoría" : tx.category();
                byCategory.merge(category, tx.amount(), BigDecimal::add);
            }
        }

        ObjectNode result = mapper.createObjectNode();
        result.put("month", month);
        result.put("income", income);
        result.put("expense", expense);
        result.put("net", income.subtract(expense));

        ArrayNode catArr = result.putArray("byCategory");
        byCategory.forEach((category, amount) -> {
            ObjectNode node = catArr.addObject();
            node.put("category", category);
            node.put("amount", amount);
        });

        ArrayNode topArr = result.putArray("topExpenses");
        txs.stream()
                .filter(tx -> !"INCOME".equalsIgnoreCase(tx.type()))
                .sorted(Comparator.comparing(TxItem::amount).reversed())
                .limit(3)
                .forEach(tx -> {
                    ObjectNode node = topArr.addObject();
                    node.put("description", tx.description());
                    node.put("amount", tx.amount());
                    node.put("category", tx.category());
                    node.put("date", tx.date().toString());
                });

        return mapper.writeValueAsString(result);
    }

    private String createTransaction(String userId, JsonNode args) throws Exception {
        String description = textOrNull(args, "description");
        String type = textOrNull(args, "type");
        String category = textOrNull(args, "category");
        if (description == null || category == null || type == null
                || args.get("amount") == null || args.get("amount").isNull()) {
            return errorJson("Faltan campos obligatorios para crear la transacción: description, amount, type, category.");
        }
        BigDecimal amount = args.get("amount").decimalValue();
        String currency = Optional.ofNullable(textOrNull(args, "currency")).orElse("ARS");
        String account = Optional.ofNullable(textOrNull(args, "account")).orElse("Efectivo");
        LocalDate date = Optional.ofNullable(parseDate(args, "date")).orElse(LocalDate.now());
        String observation = Optional.ofNullable(textOrNull(args, "observation")).orElse("");

        ObjectNode body = mapper.createObjectNode();
        body.put("description", description);
        body.put("amount", amount);
        body.put("type", type.toUpperCase());
        body.put("icon", "💰");
        body.put("category", category);
        body.put("date", date.toString());
        body.put("observation", observation);
        body.put("currency", currency.toUpperCase());
        body.putNull("amountUsd");
        body.putNull("txRate");
        body.putNull("exchangeRateType");
        body.put("account", account);
        body.putNull("recurringFrequency");
        body.put("isRecurring", false);

        JsonNode created = transactionServiceWebClient.post()
                .uri("/api/transactions")
                .header("X-User-Id", userId)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body.toString())
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();

        ObjectNode result = mapper.createObjectNode();
        result.put("success", true);
        result.put("id", created.path("id").asText());
        result.put("description", created.path("description").asText());
        result.put("amount", created.path("amount").decimalValue());
        result.put("category", created.path("category").asText());
        result.put("account", created.path("account").asText());
        result.put("date", created.path("date").asText());
        return mapper.writeValueAsString(result);
    }

    private String updateTransaction(String userId, JsonNode args) throws Exception {
        String id = textOrNull(args, "id");
        if (id == null) {
            return errorJson("Falta el parámetro 'id' de la transacción a modificar. Usá get_transactions para obtenerlo.");
        }

        // Update parcial: el server ignora los campos null, solo enviamos lo provisto.
        ObjectNode body = mapper.createObjectNode();
        String description = textOrNull(args, "description");
        if (description != null) body.put("description", description);
        if (args.hasNonNull("amount")) body.put("amount", args.get("amount").decimalValue());
        String type = textOrNull(args, "type");
        if (type != null) body.put("type", type.toUpperCase());
        String category = textOrNull(args, "category");
        if (category != null) body.put("category", category);
        LocalDate date = parseDate(args, "date");
        if (date != null) body.put("date", date.toString());
        String account = textOrNull(args, "account");
        if (account != null) body.put("account", account);
        String currency = textOrNull(args, "currency");
        if (currency != null) body.put("currency", currency.toUpperCase());
        String observation = textOrNull(args, "observation");
        if (observation != null) body.put("observation", observation);

        if (body.isEmpty()) {
            return errorJson("No se indicó ningún campo a modificar.");
        }

        JsonNode updated = transactionServiceWebClient.put()
                .uri("/api/transactions/{id}", id)
                .header("X-User-Id", userId)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body.toString())
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();

        ObjectNode result = mapper.createObjectNode();
        result.put("success", true);
        result.put("id", updated.path("id").asText());
        result.put("description", updated.path("description").asText());
        result.put("amount", updated.path("amount").decimalValue());
        result.put("type", updated.path("type").asText());
        result.put("category", updated.path("category").asText());
        result.put("account", updated.path("account").asText());
        result.put("date", updated.path("date").asText());
        return mapper.writeValueAsString(result);
    }

    private String deleteTransaction(String userId, JsonNode args) throws Exception {
        String id = textOrNull(args, "id");
        if (id == null) {
            return errorJson("Falta el parámetro 'id' de la transacción a eliminar. Usá get_transactions para obtenerlo.");
        }
        // Defensa adicional al prompt: nunca borrar sin confirmación explícita del usuario.
        if (args == null || !args.path("confirmed").asBoolean(false)) {
            return errorJson("Eliminación no confirmada por el usuario. Mostrale la transacción y pedile confirmación explícita antes de volver a invocar esta tool con confirmed=true.");
        }

        transactionServiceWebClient.delete()
                .uri("/api/transactions/{id}", id)
                .header("X-User-Id", userId)
                .retrieve()
                .toBodilessEntity()
                .block();

        ObjectNode result = mapper.createObjectNode();
        result.put("success", true);
        result.put("id", id);
        result.put("message", "Transacción eliminada.");
        return mapper.writeValueAsString(result);
    }

    private String getExchangeRate(JsonNode args) throws Exception {
        String type = textOrNull(args, "type");
        JsonNode response = transactionServiceWebClient.get()
                .uri(type != null ? "/api/rates/{type}" : "/api/rates", type != null ? new Object[]{type.toLowerCase()} : new Object[]{})
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();
        return mapper.writeValueAsString(response);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private record TxItem(String id, String description, BigDecimal amount, String type, String category,
                           LocalDate date, String account, String currency) {
    }

    private List<TxItem> fetchTransactions(String userId, LocalDate from, LocalDate to) {
        JsonNode page = transactionServiceWebClient.get()
                .uri(uriBuilder -> {
                    uriBuilder.path("/api/transactions")
                            .queryParam("size", 1000)
                            .queryParam("sort", "date,desc");
                    if (from != null) uriBuilder.queryParam("from", from.toString());
                    if (to != null) uriBuilder.queryParam("to", to.toString());
                    return uriBuilder.build();
                })
                .header("X-User-Id", userId)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .block();

        List<TxItem> result = new ArrayList<>();
        for (JsonNode item : page.path("content")) {
            result.add(new TxItem(
                    item.path("id").asText(""),
                    item.path("description").asText(""),
                    item.path("amount").decimalValue(),
                    item.path("type").asText(""),
                    item.path("category").asText(""),
                    LocalDate.parse(item.path("date").asText()),
                    item.path("account").asText(""),
                    item.path("currency").asText("ARS")
            ));
        }
        return result;
    }

    private String textOrNull(JsonNode args, String field) {
        if (args == null) return null;
        JsonNode node = args.get(field);
        return (node == null || node.isNull() || node.asText().isBlank()) ? null : node.asText();
    }

    private LocalDate parseDate(JsonNode args, String field) {
        String text = textOrNull(args, field);
        return text != null ? LocalDate.parse(text) : null;
    }

    private String errorJson(String message) {
        ObjectNode node = mapper.createObjectNode();
        node.put("error", message);
        try {
            return mapper.writeValueAsString(node);
        } catch (Exception e) {
            return "{\"error\":\"" + message.replace("\"", "'") + "\"}";
        }
    }
}
