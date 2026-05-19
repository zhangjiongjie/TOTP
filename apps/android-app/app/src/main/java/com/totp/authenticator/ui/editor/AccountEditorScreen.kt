package com.totp.authenticator.ui.editor

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.totp.authenticator.core.account.TotpAccount
import com.totp.authenticator.core.totp.TotpAlgorithm

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountEditorScreen(
    title: String,
    existingAccount: TotpAccount?,
    onSave: (TotpAccount) -> Unit,
    onDelete: ((String) -> Unit)?,
    modifier: Modifier = Modifier,
    showTitle: Boolean = true,
    importedOtpAuthUri: String? = null,
    onImportedOtpAuthUriConsumed: () -> Unit = {}
) {
    val formState = remember(existingAccount?.id) { AccountFormState(existingAccount) }
    var otpAuthUri by remember(existingAccount?.id) { mutableStateOf("") }
    var showDeleteConfirmation by remember { mutableStateOf(false) }

    LaunchedEffect(importedOtpAuthUri) {
        val uri = importedOtpAuthUri ?: return@LaunchedEffect
        otpAuthUri = uri
        formState.applyOtpAuthUri(uri)
        onImportedOtpAuthUriConsumed()
    }

    Surface(
        modifier = modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(24.dp)
        ) {
            if (showTitle) {
                item {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.headlineSmall,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                }
            }
            item {
                EditorSection {
                    OutlinedTextField(
                        value = otpAuthUri,
                        onValueChange = { otpAuthUri = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("otpauth 链接") },
                        minLines = 2
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Button(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = { formState.applyOtpAuthUri(otpAuthUri) }
                    ) {
                        Text("解析链接")
                    }
                    EditorErrors(formState.errors)
                }
                Spacer(modifier = Modifier.height(14.dp))
            }
            item {
                EditorSection {
                    OutlinedTextField(
                        value = formState.issuer,
                        onValueChange = { formState.issuer = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("发行方") },
                        singleLine = true
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = formState.accountName,
                        onValueChange = { formState.accountName = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("账号") },
                        singleLine = true
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = formState.secret,
                        onValueChange = { formState.secret = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("密钥") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    TextDropdownField(
                        label = "分组",
                        value = formState.group,
                        options = listOf("默认", "个人", "工作"),
                        onValueChange = { formState.group = it }
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedTextField(
                            value = formState.digits,
                            onValueChange = { formState.digits = it },
                            modifier = Modifier.weight(1f),
                            label = { Text("位数") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                        )
                        OutlinedTextField(
                            value = formState.period,
                            onValueChange = { formState.period = it },
                            modifier = Modifier.weight(1f),
                            label = { Text("周期") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                        )
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    TextDropdownField(
                        label = "算法",
                        value = formState.algorithm.name,
                        options = TotpAlgorithm.entries.map { it.name },
                        onValueChange = { selected ->
                            formState.algorithm = TotpAlgorithm.fromName(selected)
                        }
                    )
                }
                Spacer(modifier = Modifier.height(20.dp))
            }
            item {
                EditorActions(
                    isEditing = existingAccount != null && onDelete != null,
                    onDelete = { showDeleteConfirmation = true },
                    onSave = {
                        formState.toAccount(existingAccount, System.currentTimeMillis())?.let(onSave)
                    }
                )
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }

    if (showDeleteConfirmation && existingAccount != null && onDelete != null) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirmation = false },
            title = { Text("删除账号？") },
            text = { Text("该账号将从本地保管库中移除。") },
            confirmButton = {
                TextButton(onClick = { onDelete(existingAccount.id) }) {
                    Text("删除", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirmation = false }) {
                    Text("取消")
                }
            }
        )
    }
}

@Composable
private fun EditorSection(
    content: @Composable ColumnScope.() -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.extraLarge,
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.78f),
        tonalElevation = 1.dp
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.Top,
            content = content
        )
    }
}

@Composable
private fun EditorErrors(errors: List<String>) {
    if (errors.isEmpty()) {
        return
    }
    Spacer(modifier = Modifier.height(12.dp))
    errors.forEach { error ->
        Text(
            text = error,
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

@Composable
private fun EditorActions(
    isEditing: Boolean,
    onDelete: () -> Unit,
    onSave: () -> Unit
) {
    if (isEditing) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Button(
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = androidx.compose.ui.graphics.Color(0xFFFDEDED),
                    contentColor = androidx.compose.ui.graphics.Color(0xFFB53E3E)
                ),
                onClick = onDelete
            ) {
                Text("删除")
            }
            Button(
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp),
                onClick = onSave
            ) {
                Text("保存")
            }
        }
    } else {
        Button(
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            onClick = onSave
        ) {
            Text("保存")
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TextDropdownField(
    label: String,
    value: String,
    options: List<String>,
    onValueChange: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it }
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            singleLine = true
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option) },
                    onClick = {
                        onValueChange(option)
                        expanded = false
                    }
                )
            }
        }
    }
}
