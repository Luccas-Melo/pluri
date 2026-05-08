function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    Logger.log("Request: " + JSON.stringify(e.parameter));
    
    var action = e.parameter.action;
    
    // GET CARTOES - Retorna cartões da aba "Nuvem GastosBL" ou aba ativa
    if (action === "getCartoes") {
      var cartoesSheet = ss.getSheetByName("Nuvem GastosBL") || sheet;
      var rows = cartoesSheet.getDataRange().getValues();
      var cartoes = [];
      
      // Começa da linha 2 (ignora cabeçalho)
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        var tipo = row[0];
        var valor = row[1];
        
        if (tipo === "cartao" && valor && typeof valor === "string" && valor.trim() !== "") {
          cartoes.push(valor.trim());
        }
      }
      
      var output = ContentService.createTextOutput(JSON.stringify(cartoes));
      output.setMimeType(ContentService.MimeType.JSON);
      return output;
    }
    
    // SAVE CARTOES - Salva cartões na planilha
    if (action === "saveCartoes") {
      var cartoesSheet = ss.getSheetByName("Nuvem GastosBL");
      
      // Se não existe a aba, cria
      if (!cartoesSheet) {
        cartoesSheet = ss.insertSheet("Nuvem GastosBL");
        cartoesSheet.appendRow(["Tipo", "Valor"]);
      }
      
      // Limpa dados antigos (mantém cabeçalho)
      var lastRow = cartoesSheet.getLastRow();
      if (lastRow > 1) {
        cartoesSheet.deleteRows(2, lastRow - 1);
      }
      
      // Adiciona novos cartões
      var cartoes = JSON.parse(e.parameter.cartoes || "[]");
      for (var i = 0; i < cartoes.length; i++) {
        cartoesSheet.appendRow(["cartao", cartoes[i]]);
      }
      
      var output = ContentService.createTextOutput(JSON.stringify({success: true, count: cartoes.length}));
      output.setMimeType(ContentService.MimeType.JSON);
      return output;
    }
    
    // GET - Retorna todos os dados da planilha (excluindo cabeçalho e linhas vazias/invalidas)
    if (action === "get") {
      var rows = sheet.getDataRange().getValues();
      var dados = [];
      
      // Começa da linha 2 (ignora cabeçalho)
      for (var i = 1; i < rows.length; i++) {
        var row = rows[i];
        var id = row[6];
        var valor = row[2];
        var pagador = row[3];
        
        // Ignora linha de TOTAL
        if (typeof row[0] === 'string' && row[0].toLowerCase().includes('total')) {
          continue;
        }
        
        // Só adiciona se tiver ID válido e valor > 0 e pagador válido
        if (id && !isNaN(parseFloat(valor)) && parseFloat(valor) > 0 && pagador) {
          dados.push({
            id: parseInt(id),
            dataRaw: row[0],
            descricao: row[1],
            valor: parseFloat(valor),
            pagador: pagador,
            categoria: row[4],
            metodo: row[5]
          });
        }
      }
      
      // Retorna JSON
      var output = ContentService.createTextOutput(JSON.stringify(dados));
      output.setMimeType(ContentService.MimeType.JSON);
      return output;
    }
    
    // DELETE
    if (action === "delete") {
      var idToDelete = e.parameter.id;
      var rows = sheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        var cellId = rows[i][6] ? rows[i][6].toString() : "";
        if (cellId === idToDelete) {
          sheet.deleteRow(i + 1);
          return ContentService.createTextOutput("OK - Deletado");
        }
      }
      return ContentService.createTextOutput("NOT_FOUND");
    }
    
    // UPDATE - Atualiza um gasto existente
    if (action === "update") {
      var idToUpdate = e.parameter.id;
      var rows = sheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        var cellId = rows[i][6] ? rows[i][6].toString() : "";
        if (cellId === idToUpdate) {
          // Atualiza os dados na linha
          var valorNum = parseFloat(e.parameter.valor) || 0;
          sheet.getRange(i + 1, 1).setValue(e.parameter.dataRaw || "");
          sheet.getRange(i + 1, 2).setValue(e.parameter.descricao || "");
          sheet.getRange(i + 1, 3).setValue(valorNum);
          sheet.getRange(i + 1, 4).setValue(e.parameter.pagador || "");
          sheet.getRange(i + 1, 5).setValue(e.parameter.categoria || "");
          sheet.getRange(i + 1, 6).setValue(e.parameter.metodo || "");
          // Aplica formatação de moeda na coluna de valor
          sheet.getRange(i + 1, 3).setNumberFormat('R$ #,##0.00');
          return ContentService.createTextOutput("OK - Atualizado");
        }
      }
      return ContentService.createTextOutput("NOT_FOUND");
    }
    
    // INSERT - Só insere se tiver valor válido (não é chamada de ping/verificação)
    var valorNum = parseFloat(e.parameter.valor) || 0;
    
    // Verifica se tem dados válidos para inserir (evita linhas vazias em chamadas de verificação)
    if (valorNum <= 0 || !e.parameter.id) {
      return ContentService.createTextOutput("SKIP - Sem dados válidos");
    }
    
    var data = [
      e.parameter.dataRaw || "",
      e.parameter.descricao || "",
      valorNum,  // Valor como número para formatação correta
      e.parameter.pagador || "",
      e.parameter.categoria || "",
      e.parameter.metodo || "",
      e.parameter.id || ""
    ];
    
    // Verifica se a linha 2 tem o cabeçalho "TOTAL" ou é um dado antigo
    var row2Value = sheet.getRange(2, 1).getValue();
    var isTotal = typeof row2Value === 'string' && row2Value.toLowerCase().includes('total');
    
    if (isTotal) {
      // Se linha 2 é TOTAL, insere antes dela (ela vai para linha 3)
      sheet.insertRowBefore(2);
      sheet.getRange(2, 1, 1, 7).setValues([data]);
      
      // Copia formatação da linha 3 (que era o total, agora tem o estilo)
      var sourceRange = sheet.getRange(3, 1, 1, 7);
      var targetRange = sheet.getRange(2, 1, 1, 7);
      sourceRange.copyTo(targetRange, {formatOnly: true});
    } else {
      // Se linha 2 é um dado antigo, insere antes dela
      sheet.insertRowBefore(2);
      sheet.getRange(2, 1, 1, 7).setValues([data]);
      
      // Copia formatação da linha 3 (dado antigo que tem o estilo correto)
      var sourceRange = sheet.getRange(3, 1, 1, 7);
      var targetRange = sheet.getRange(2, 1, 1, 7);
      sourceRange.copyTo(targetRange, {formatOnly: true});
    }
    
    // Aplica formatação de moeda brasileira na coluna de valor (C)
    var valorCell = sheet.getRange(2, 3);  // Coluna C = índice 3
    valorCell.setNumberFormat('R$ #,##0.00');
    
    Logger.log("Inserido na linha 2 com formatação copiada");
    return ContentService.createTextOutput("OK - Inserido");
    
  } catch (error) {
    Logger.log("ERRO: " + error.message);
    return ContentService.createTextOutput("ERROR: " + error.message);
  }
}
