package com.totp.authenticator.ui.editor

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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

@Composable
fun AccountEditorScreen(
    title: String,
    existingAccount: TotpAccount?,
    onSave: (TotpAccount) -> Unit,
    onDelete: ((String) -> Unit)?,
    onBack: () -> Unit
) {
    val formState = remember(existingAccount?.id) { AccountFormState(existingAccount) }
    var otpAuthUri by remember(existingAccount?.id) { mutableStateOf("") }
    var showDeleteConfirmation by remember { mutableStateOf(false) }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onBackground
            )
            Spacer(modifier = Modifier.height(16.dp))
            OutlinedTextField(
                value = formState.issuer,
                onValueChange = { formState.issuer = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Issuer") },
                singleLine = true
            )
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedTextField(
                value = formState.accountName,
                onValueChange = { formState.accountName = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Account") },
                singleLine = true
            )
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedTextField(
                value = formState.secret,
                onValueChange = { formState.secret = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Secret") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters)
            )
            Spacer(modifier = Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = formState.digits,
                    onValueChange = { formState.digits = it },
                    modifier = Modifier.weight(1f),
                    label = { Text("Digits") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                )
                OutlinedTextField(
                    value = formState.period,
                    onValueChange = { formState.period = it },
                    modifier = Modifier.weight(1f),
                    label = { Text("Period") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                )
            }
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedTextField(
                value = formState.group,
                onValueChange = { formState.group = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Group") },
                singleLine = true
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Algorithm",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onBackground
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TotpAlgorithm.entries.forEach { algorithm ->
                    FilterChip(
                        selected = formState.algorithm == algorithm,
                        onClick = { formState.algorithm = algorithm },
                        label = { Text(algorithm.name) }
                    )
                }
            }
            Spacer(modifier = Modifier.height(20.dp))
            OutlinedTextField(
                value = otpAuthUri,
                onValueChange = { otpAuthUri = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("otpauth URI") },
                minLines = 2
            )
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = { formState.applyOtpAuthUri(otpAuthUri) }
            ) {
                Text("Apply URI")
            }
            if (formState.errors.isNotEmpty()) {
                Spacer(modifier = Modifier.height(12.dp))
                formState.errors.forEach { error ->
                    Text(
                        text = error,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
            Spacer(modifier = Modifier.height(24.dp))
            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    formState.toAccount(existingAccount, System.currentTimeMillis())?.let(onSave)
                }
            ) {
                Text("Save")
            }
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = onBack
            ) {
                Text("Back")
            }
            if (existingAccount != null && onDelete != null) {
                Spacer(modifier = Modifier.height(8.dp))
                TextButton(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { showDeleteConfirmation = true }
                ) {
                    Text("Delete", color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }

    if (showDeleteConfirmation && existingAccount != null && onDelete != null) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirmation = false },
            title = { Text("Delete account?") },
            text = { Text("This account will be removed from the vault.") },
            confirmButton = {
                TextButton(onClick = { onDelete(existingAccount.id) }) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirmation = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}
