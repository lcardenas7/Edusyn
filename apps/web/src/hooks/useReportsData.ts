import { useState, useEffect, useMemo } from 'react'
import { academicYearsApi, academicTermsApi, teacherAssignmentsApi, groupsApi, subjectsApi, studentsApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

export function useReportsData() {
  const { institution } = useAuth()
  
  // Datos base compartidos
  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [terms, setTerms] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  
  // Filtros compartidos
  const [filterYear, setFilterYear] = useState('')
  const [filterPeriod, setFilterPeriod] = useState('')
  const [filterGrade, setFilterGrade] = useState('all')
  const [filterSubject, setFilterSubject] = useState('all')
  const [filterTeacher, setFilterTeacher] = useState('all')
  const [filterStudentId, setFilterStudentId] = useState('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  
  const [loading, setLoading] = useState(false)

  // Cargar años académicos al iniciar
  useEffect(() => {
    const loadYears = async () => {
      try {
        const response = await academicYearsApi.getAll()
        const years = response.data || []
        setAcademicYears(years)
        const activeYear = years.find((y: any) => y.status === 'ACTIVE') || years[0]
        if (activeYear) setFilterYear(activeYear.id)
      } catch (err) {
        console.error('Error loading years:', err)
      }
    }
    loadYears()
  }, [])

  // Cargar datos cuando cambia el año
  useEffect(() => {
    const loadData = async () => {
      if (!filterYear) return
      setLoading(true)
      try {
        const [termsRes, groupsRes, subjectsRes, assignmentsRes] = await Promise.all([
          academicTermsApi.getAll(filterYear),
          groupsApi.getAll(),
          subjectsApi.getAll(),
          teacherAssignmentsApi.getAll({ academicYearId: filterYear })
        ])
        setTerms(termsRes.data || [])
        setGroups(groupsRes.data || [])
        setSubjects(subjectsRes.data || [])
        
        // Extraer docentes únicos
        const assignments = assignmentsRes.data || []
        const uniqueTeachers = new Map()
        assignments.forEach((a: any) => {
          if (a.teacher && !uniqueTeachers.has(a.teacherId)) {
            uniqueTeachers.set(a.teacherId, {
              id: a.teacherId,
              name: `${a.teacher.firstName} ${a.teacher.lastName}`
            })
          }
        })
        setTeachers(Array.from(uniqueTeachers.values()))
        
        if (termsRes.data?.length > 0) setFilterPeriod(termsRes.data[0].id)
      } catch (err) {
        console.error('Error loading data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [filterYear])

  // Cargar estudiantes cuando cambia el grupo
  useEffect(() => {
    const loadStudents = async () => {
      if (!filterGrade || filterGrade === 'all') {
        setStudents([])
        return
      }
      try {
        const response = await studentsApi.getAll({ groupId: filterGrade })
        setStudents(response.data || [])
      } catch (err) {
        console.error('Error loading students:', err)
        setStudents([])
      }
    }
    loadStudents()
  }, [filterGrade])

  return {
    // Datos
    academicYears,
    terms,
    groups,
    subjects,
    teachers,
    students,
    loading,
    
    // Filtros
    filterYear, setFilterYear,
    filterPeriod, setFilterPeriod,
    filterGrade, setFilterGrade,
    filterSubject, setFilterSubject,
    filterTeacher, setFilterTeacher,
    filterStudentId, setFilterStudentId,
    filterDateFrom, setFilterDateFrom,
    filterDateTo, setFilterDateTo,
    filterStatus, setFilterStatus,
  }
}
