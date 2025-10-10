import React, { useEffect, useState } from "react";
import { Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { FlatList, GestureHandlerRootView } from "react-native-gesture-handler";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import { getAllTodos, getDBVersion, getSQLiteVersion, insertTodo, migrateDB, updateTodo } from "@/lib/db";
import { Filter, TodoItem, uuid } from "@/lib/types";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

function ListItem({ todoItem, toggleTodo }: { todoItem: TodoItem; toggleTodo: (id: uuid) => void }) {
  const isDone = todoItem.status === "done";

  const renderRightActions = () => {
    return (
      <TouchableOpacity
        style={[
          styles.swipeableButton,
          { backgroundColor: isDone ? "#f312f3ff" : "#2ecc71" }
        ]}
        onPress={() => toggleTodo(todoItem.id)}
      >
        <Text style={styles.swipeableText}>
          {isDone ? "Marcar como pendente" : "Marcar como concluído"}
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <GestureHandlerRootView>
      <ReanimatedSwipeable
        friction={2}
        rightThreshold={40}
        renderRightActions={renderRightActions}
      >
        <View style={{ padding: 5, borderBottomWidth: 1, borderBottomColor: "gray" }}>
          <Text style={[styles.item, isDone && styles.itemDone]}>
            {todoItem.text}
          </Text>
        </View>
      </ReanimatedSwipeable>
    </GestureHandlerRootView>
  );
}

function AddTodoForm({ addTodoHandler }: { addTodoHandler: (text: string) => void }) {
  const [text, setText] = React.useState("");

  const handlePress = () => {
    if(text.trim().length === 0) return;
    
    addTodoHandler(text);
    setText("");
    Keyboard.dismiss();
  };

  return (
    <View style={{ width: "100%", marginTop: 10, paddingHorizontal: 20, alignItems: "center" }}>
      <TextInput
        value={text}
        onChangeText={setText}
        style={styles.textInput}
        placeholder="O que você precisa fazer?"
        placeholderTextColor="#000"
        onSubmitEditing={handlePress}
        returnKeyType="done"
      />
    </View>
  );
}

function TodoFilter({ currentFilter, onFilterChange }: { currentFilter: Filter, onFilterChange: (filter: Filter) => void }) {
  const filters : { key: Filter, label: string }[] = [
    { key: "all", label: "TODOS" },
    { key: "pending", label: "PENDENTES" },
    { key: "done", label: "CONCLUÍDOS" }
  ];

  return (
    <View style={styles.filterContainer}>
      {filters.map((filter) => (
        <TouchableOpacity 
          key={filter.key}
          style={[
            styles.filterButton, 
            currentFilter === filter.key && styles.filterButtonActive
          ]}
          onPress={() => onFilterChange(filter.key)}
        >
          <Text style={[
              styles.filterText, 
              currentFilter === filter.key && styles.filterTextActive
            ]}>
            {filter.label}
          </Text>
        </TouchableOpacity>
        ))}
    </View>
  ) 
}

function Footer() {
  const db = useSQLiteContext();

  const [sqliteVersion, setSqliteVersion] = useState<string>("");
  const [dbVersion, setDBVersion] = useState<string>();

  useEffect(() => {
    async function setup() {
      const sqliteVersionResult = await getSQLiteVersion(db);

      // eslint-disable-next-line no-unused-expressions
      sqliteVersionResult 
        ? setSqliteVersion(sqliteVersionResult['sqlite_version()'])
        : setSqliteVersion('unknown');

      const dbVersionResult = await getDBVersion(db);
      
      // eslint-disable-next-line no-unused-expressions
      dbVersionResult 
        ? setDBVersion(dbVersionResult['user_version'].toString())
        : setDBVersion('unknown');
      }
    
    setup();
  }, [db]);
  
  return (
    <View>
      <Text style={{padding: 20}}>SQLITE version: {sqliteVersion} / DBVersion: {dbVersion}</Text>
    </View>
  )
}


function TodoList() {
  const [todos, setTodos] = React.useState<TodoItem[]>([]);

  const db = useSQLiteContext();

  useEffect(() => {
    async function load() {
      const result = await getAllTodos(db);
      setTodos(result);
    }

    load();
  }, [db]);

  const [currentFilter, setCurrentFilter] = useState<Filter>("all");

  const filteredTodos = todos.filter(todo => {
    if (currentFilter === "all") return true;
    if (currentFilter === "pending") return todo.status === "pending";
    if (currentFilter === "done") return todo.status === "done";
    return true;
  });

  const addTodo = async (text: string) => {
    await insertTodo(db, text);
    const todos = await getAllTodos(db);
    setTodos(todos);
  };

  const toggleTodo = async (id: uuid) => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    const newStatus = todo.status === "pending" ? "done" : "pending";
    await updateTodo(db, newStatus, id);
    const updatedTodos = await getAllTodos(db); 
    setTodos(updatedTodos);
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <Text style={{ fontSize: 32, fontWeight: "bold", marginTop: 20 }}>
        TODO List
      </Text>
      <AddTodoForm addTodoHandler={addTodo} />
      <TodoFilter currentFilter={currentFilter} onFilterChange={setCurrentFilter}/>
      <FlatList
        style={styles.list}
        data={filteredTodos.sort((a, b) => {
          const aDate = new Date(a.createdAt ?? new Date(0));
          const bDate = new Date(b.createdAt ?? new Date(0));

          if (a.status !== b.status) {
            return a.status === 'pending' ? -1 : 1;
          }

          return bDate.getTime() - aDate.getTime();
        })}
        renderItem={({ item }) => <ListItem todoItem={item} toggleTodo={toggleTodo} />}
      />
    </GestureHandlerRootView>
  );
}

export default function Index() {
  return <SafeAreaProvider>
    <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
      <SQLiteProvider databaseName="todos.db" onInit={migrateDB}>
        <TodoList />
        <Footer />
      </SQLiteProvider>
    </SafeAreaView>
  </SafeAreaProvider>
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignContent: "center",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
  textInput: {
    width: "100%",
    borderColor: "black",
    borderWidth: 1,
    margin: 10,
    padding: 10,
    borderRadius: 50,
  },
  item: {
    padding: 10,
    fontSize: 18,
    height: 44,
  },
  itemDone: {
    padding: 10,
    fontSize: 18,
    height: 44,
    textDecorationLine: "line-through",
  },
  list: {
    width: "100%",
    backgroundColor: "white",
    padding: 10,
    marginTop: 20,
  },
  filterContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 10,
    marginVertical: 10,
  },
  filterButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "lightgray",
  },
  filterButtonActive: {
    backgroundColor: '#9b9999ff',
  },
  filterText: {
    fontSize: 16,
    color: "black",
  },
  filterTextActive: {
    fontWeight: 'bold',
  },
  swipeableButton: {
    justifyContent: "center",
    paddingHorizontal: 10,
    width: 180,
  },
  swipeableText: {
    fontSize: 14,
    color: "white",
    fontWeight: "bold",
  }
});
