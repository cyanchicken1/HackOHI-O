import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  SafeAreaView,
  Alert 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker'; // You'll need to install this: npx expo install @react-native-picker/picker
import { Colors, Spacing, Typography, Layout } from './theme'; // Import your theme

// Import your building data
import buildingData from './osu_building_points.json';

// Get a simple array of building objects to use in the Picker
const buildingList = buildingData.buildings.map(b => ({
  name: b.name,
  number: b.number,
})).sort((a, b) => a.name.localeCompare(b.name)); // Sort them alphabetically

const STORAGE_KEY = '@MySchedule';

export default function ScheduleScreen() {
  const [schedule, setSchedule] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  // State for the new class form
  const [eventName, setEventName] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState(buildingList[0]?.number);
  const [eventTime, setEventTime] = useState(''); // Simple text input for hackathon

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
      setSchedule(jsonValue != null ? JSON.parse(jsonValue) : []);
    } catch (e) {
      console.warn('Failed to load schedule.', e);
    }
  };

  const saveSchedule = async (newSchedule) => {
    try {
      const jsonValue = JSON.stringify(newSchedule);
      await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
      setSchedule(newSchedule);
    } catch (e) {
      console.warn('Failed to save schedule.', e);
    }
  };

  const handleAddClass = () => {
    if (!eventName || !selectedBuilding || !eventTime) {
      Alert.alert('Missing Info', 'Please fill out all fields.'); // Using Alert for native feel
      return;
    }

    const building = buildingList.find(b => b.number === selectedBuilding);
    
    const newClass = {
      id: Date.now().toString(), // Simple unique ID
      name: eventName,
      buildingName: building.name,
      buildingNumber: building.number,
      time: eventTime,
    };
    
    saveSchedule([...schedule, newClass]);
    
    // Reset form and close modal
    setIsModalVisible(false);
    setEventName('');
    setSelectedBuilding(buildingList[0]?.number);
    setEventTime('');
  };

  const handleDeleteClass = (id) => {
    const newSchedule = schedule.filter(item => item.id !== id);
    saveSchedule(newSchedule);
  };

  const renderItem = ({ item }) => (
    <View style={styles.classItem}>
      <View style={styles.classInfo}>
        <Text style={styles.classTime}>{item.time}</Text>
        <Text style={styles.className}>{item.name}</Text>
        <Text style={styles.classBuilding}>{item.buildingName}</Text>
      </View>
      <TouchableOpacity onPress={() => handleDeleteClass(item.id)}>
        <Text style={styles.deleteButton}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>My Schedule</Text>
      <FlatList
        data={schedule}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.emptyText}>No classes added yet.</Text>}
      />
      <TouchableOpacity style={styles.addButton} onPress={() => setIsModalVisible(true)}>
        <Text style={styles.addButtonText}>+ Add Class</Text>
      </TouchableOpacity>

      {/* "Add Class" Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalHeader}>Add New Class</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Event Name (e.g., CS 3231)"
              placeholderTextColor={Colors.textSecondary}
              value={eventName}
              onChangeText={setEventName}
            />
            <TextInput
              style={styles.input}
              placeholder="Time (e.g., 2:30 PM)"
              placeholderTextColor={Colors.textSecondary}
              value={eventTime}
              onChangeText={setEventTime}
            />
            
            <Text style={styles.pickerLabel}>Building:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedBuilding}
                onValueChange={(itemValue) => setSelectedBuilding(itemValue)}
                style={styles.picker}
              >
                {buildingList.map((building) => (
                  <Picker.Item 
                    key={building.number} 
                    label={building.name} 
                    value={building.number} 
                  />
                ))}
              </Picker>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.saveButton]} 
                onPress={handleAddClass}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// --- All Styles Use Your theme.js File ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.md,
  },
  header: {
    ...Typography.h1,
    color: Colors.primary,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  classItem: {
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Layout.shadow,
  },
  classInfo: {
    flex: 1,
  },
  classTime: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  className: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  classBuilding: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  deleteButton: {
    ...Typography.body,
    color: Colors.error,
    fontWeight: '600',
    marginLeft: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: Layout.borderRadius,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Layout.shadow,
  },
  addButtonText: {
    ...Typography.h2,
    fontSize: 18,
    color: Colors.surface,
  },
  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: Colors.surface,
    borderRadius: Layout.borderRadius,
    padding: Spacing.lg,
    ...Layout.shadow,
  },
  modalHeader: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  input: {
    ...Typography.body,
    height: 48,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.background,
    marginBottom: Spacing.md,
  },
  pickerLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  pickerContainer: {
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Spacing.sm,
    backgroundColor: Colors.background,
    marginBottom: Spacing.lg,
  },
  picker: {
    height: 120, // This height works well for the wheel
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Spacing.sm,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.border,
    marginRight: Spacing.sm,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    marginLeft: Spacing.sm,
  },
  buttonText: {
    ...Typography.body,
    color: Colors.surface,
    fontWeight: '600',
  },
});