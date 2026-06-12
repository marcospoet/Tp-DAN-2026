package com.pesito.ai.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Registro de las tools sobre datos del usuario que el agente puede invocar
 * durante el chat (function calling). Los schemas se generan con un subset de
 * JSON Schema compatible con Claude (input_schema), OpenAI (function.parameters)
 * y Gemini (functionDeclarations.parameters).
 */
@Component
public class ToolRegistry {

    private final List<ToolDefinition> tools;

    public ToolRegistry(ObjectMapper mapper) {
        this.tools = List.of(
                getAccountBalances(mapper),
                getTransactions(mapper),
                getMonthlySummary(mapper),
                createTransaction(mapper),
                updateTransaction(mapper),
                deleteTransaction(mapper),
                getExchangeRate(mapper),
                searchFinancialKnowledge(mapper),
                searchConversationHistory(mapper)
        );
    }

    public List<ToolDefinition> getTools() {
        return tools;
    }

    private ToolDefinition getAccountBalances(ObjectMapper mapper) {
        ObjectNode params = objectSchema(mapper);
        return new ToolDefinition(
                "get_account_balances",
                "Obtiene el balance (ingresos menos egresos registrados) por cuenta del usuario. " +
                        "Usala para responder preguntas sobre el saldo o estado de cada cuenta/billetera.",
                params
        );
    }

    private ToolDefinition getTransactions(ObjectMapper mapper) {
        ObjectNode params = objectSchema(mapper);
        ObjectNode props = (ObjectNode) params.get("properties");
        props.set("category", stringProp(mapper, "Categoría exacta para filtrar (ej: \"Comida\", \"Transporte\")."));
        props.set("account", stringProp(mapper, "Cuenta/billetera exacta para filtrar (ej: \"Efectivo\", \"Mercado Pago\")."));
        props.set("type", enumStringProp(mapper, "Tipo de movimiento.", List.of("INCOME", "EXPENSE")));
        props.set("date_from", stringProp(mapper, "Fecha desde (inclusive), formato YYYY-MM-DD."));
        props.set("date_to", stringProp(mapper, "Fecha hasta (inclusive), formato YYYY-MM-DD."));
        return new ToolDefinition(
                "get_transactions",
                "Lista transacciones del usuario, con filtros opcionales por categoría, cuenta, tipo y rango de fechas. " +
                        "Devuelve hasta 50 resultados. Usala para consultas detalladas que el contexto financiero no cubre.",
                params
        );
    }

    private ToolDefinition getMonthlySummary(ObjectMapper mapper) {
        ObjectNode params = objectSchema(mapper);
        ObjectNode props = (ObjectNode) params.get("properties");
        props.set("month", stringProp(mapper, "Mes a resumir, formato YYYY-MM (ej: \"2026-06\")."));
        ((ArrayNode) params.get("required")).add("month");
        return new ToolDefinition(
                "get_monthly_summary",
                "Devuelve el resumen de un mes: ingresos, egresos, neto, desglose por categoría y top 3 gastos. " +
                        "Usala para comparar meses o responder preguntas sobre un mes específico.",
                params
        );
    }

    private ToolDefinition createTransaction(ObjectMapper mapper) {
        ObjectNode params = objectSchema(mapper);
        ObjectNode props = (ObjectNode) params.get("properties");
        props.set("description", stringProp(mapper, "Descripción breve del movimiento (ej: \"Nafta\", \"Sueldo\")."));
        props.set("amount", numberProp(mapper, "Monto del movimiento, siempre positivo."));
        props.set("type", enumStringProp(mapper, "Tipo de movimiento.", List.of("INCOME", "EXPENSE")));
        props.set("category", stringProp(mapper, "Categoría del movimiento (ej: \"Comida\", \"Transporte\", \"Sueldo\")."));
        props.set("currency", enumStringProp(mapper, "Moneda del movimiento. Default ARS.", List.of("ARS", "USD")));
        props.set("account", stringProp(mapper, "Cuenta/billetera usada (ej: \"Efectivo\", \"Naranja X\"). Default \"Efectivo\"."));
        props.set("date", stringProp(mapper, "Fecha del movimiento, formato YYYY-MM-DD. Default hoy."));
        props.set("observation", stringProp(mapper, "Nota u observación adicional, opcional."));
        ArrayNode required = (ArrayNode) params.get("required");
        required.add("description");
        required.add("amount");
        required.add("type");
        required.add("category");
        return new ToolDefinition(
                "create_transaction",
                "Registra un nuevo ingreso o egreso en las transacciones del usuario. " +
                        "Usala cuando el usuario pida registrar/anotar un gasto o ingreso.",
                params
        );
    }

    private ToolDefinition updateTransaction(ObjectMapper mapper) {
        ObjectNode params = objectSchema(mapper);
        ObjectNode props = (ObjectNode) params.get("properties");
        props.set("id", stringProp(mapper, "ID (UUID) de la transacción a modificar. Obtenelo primero con get_transactions."));
        props.set("description", stringProp(mapper, "Nueva descripción, opcional."));
        props.set("amount", numberProp(mapper, "Nuevo monto, siempre positivo, opcional."));
        props.set("type", enumStringProp(mapper, "Nuevo tipo de movimiento, opcional.", List.of("INCOME", "EXPENSE")));
        props.set("category", stringProp(mapper, "Nueva categoría, opcional."));
        props.set("date", stringProp(mapper, "Nueva fecha, formato YYYY-MM-DD, opcional."));
        props.set("account", stringProp(mapper, "Nueva cuenta/billetera, opcional."));
        props.set("currency", enumStringProp(mapper, "Nueva moneda, opcional.", List.of("ARS", "USD")));
        props.set("observation", stringProp(mapper, "Nueva observación, opcional."));
        ((ArrayNode) params.get("required")).add("id");
        return new ToolDefinition(
                "update_transaction",
                "Modifica campos de una transacción existente del usuario. Solo enviá los campos a cambiar. " +
                        "Usá get_transactions primero para obtener el id de la transacción.",
                params
        );
    }

    private ToolDefinition deleteTransaction(ObjectMapper mapper) {
        ObjectNode params = objectSchema(mapper);
        ObjectNode props = (ObjectNode) params.get("properties");
        props.set("id", stringProp(mapper, "ID (UUID) de la transacción a eliminar. Obtenelo primero con get_transactions."));
        ObjectNode confirmed = mapper.createObjectNode();
        confirmed.put("type", "boolean");
        confirmed.put("description", "Debe ser true. Solo invocá esta tool después de que el usuario " +
                "confirmó explícitamente la eliminación en la conversación.");
        props.set("confirmed", confirmed);
        ArrayNode required = (ArrayNode) params.get("required");
        required.add("id");
        required.add("confirmed");
        return new ToolDefinition(
                "delete_transaction",
                "Elimina una transacción existente del usuario. Antes de invocarla, mostrale al usuario la " +
                        "transacción encontrada y pedile confirmación explícita.",
                params
        );
    }

    private ToolDefinition getExchangeRate(ObjectMapper mapper) {
        ObjectNode params = objectSchema(mapper);
        ObjectNode props = (ObjectNode) params.get("properties");
        props.set("type", enumStringProp(mapper, "Tipo de cotización del dólar. Si no se especifica, devuelve todas.",
                List.of("blue", "oficial", "tarjeta", "mep")));
        return new ToolDefinition(
                "get_exchange_rate",
                "Obtiene la cotización actual del dólar (blue, oficial, tarjeta, mep) en tiempo real.",
                params
        );
    }

    private ToolDefinition searchFinancialKnowledge(ObjectMapper mapper) {
        ObjectNode params = objectSchema(mapper);
        ObjectNode props = (ObjectNode) params.get("properties");
        props.set("query", stringProp(mapper, "Consulta en lenguaje natural sobre comisiones, productos o regulaciones financieras."));
        ((ArrayNode) params.get("required")).add("query");
        return new ToolDefinition(
                "search_financial_knowledge",
                "Busca información sobre billeteras virtuales, bancos, AFIP/BCRA y educación financiera " +
                        "en la base de conocimiento. Usala para preguntas sobre comisiones, requisitos, " +
                        "regulaciones o conceptos financieros que no dependan de los datos del usuario.",
                params
        );
    }

    private ToolDefinition searchConversationHistory(ObjectMapper mapper) {
        ObjectNode params = objectSchema(mapper);
        ObjectNode props = (ObjectNode) params.get("properties");
        props.set("query", stringProp(mapper, "Qué buscar en conversaciones pasadas, en lenguaje natural " +
                "(ej: \"qué dije sobre mis vacaciones\", \"cuándo hablamos del aguinaldo\")."));
        ((ArrayNode) params.get("required")).add("query");
        return new ToolDefinition(
                "search_conversation_history",
                "Busca en el historial de conversaciones pasadas del usuario (memoria de largo plazo). " +
                        "Usala cuando el usuario haga referencia a algo que dijo, preguntó o acordó antes " +
                        "y no esté en la conversación actual.",
                params
        );
    }

    // ── JSON Schema helpers ─────────────────────────────────────────────────

    private ObjectNode objectSchema(ObjectMapper mapper) {
        ObjectNode schema = mapper.createObjectNode();
        schema.put("type", "object");
        schema.putObject("properties");
        schema.putArray("required");
        return schema;
    }

    private ObjectNode stringProp(ObjectMapper mapper, String description) {
        ObjectNode node = mapper.createObjectNode();
        node.put("type", "string");
        node.put("description", description);
        return node;
    }

    private ObjectNode numberProp(ObjectMapper mapper, String description) {
        ObjectNode node = mapper.createObjectNode();
        node.put("type", "number");
        node.put("description", description);
        return node;
    }

    private ObjectNode enumStringProp(ObjectMapper mapper, String description, List<String> values) {
        ObjectNode node = stringProp(mapper, description);
        ArrayNode enumArr = node.putArray("enum");
        values.forEach(enumArr::add);
        return node;
    }
}
